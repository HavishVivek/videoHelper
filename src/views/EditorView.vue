<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScripts } from '@/composables/useScripts'
import { useScriptsStore } from '@/stores/scripts'
import { useGroq } from '@/composables/useGroq'
import PageContainer from '@/components/layout/PageContainer.vue'
import ScriptEditor from '@/components/script/ScriptEditor.vue'
import PackagingView from '@/components/script/PackagingView.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import RetentionChart from '@/components/ui/RetentionChart.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import PrePostChecklistModal from '@/components/script/PrePostChecklistModal.vue'

const route = useRoute()
const router = useRouter()
const scriptsStore = useScriptsStore()
const { load, save, setupAutoSave, fetchThumbnails, fetchMetadata } = useScripts()
const { getFeedback, getPrediction } = useGroq()

const scriptId = ref(null)
const content = ref('')
const feedback = ref(null)
const retentionData = ref([])
const loadingScript = ref(true)
const savingFeedback = ref(false)
const lastSaved = ref(null)
const editorMode = ref('script') // 'script' | 'packaging'
const showChecklistModal = ref(false)

// Make script reactive to store changes
const script = computed(() => {
  if (!scriptId.value) return null
  return scriptsStore.scripts.find(s => s.id === scriptId.value) || scriptsStore.currentScript
})

// Text to Speech
const isReading = ref(false)
let utterance = null

function toggleReadAloud() {
  if (isReading.value) {
    window.speechSynthesis.cancel()
    isReading.value = false
    return
  }
  
  if (!content.value) return
  
  // Clean markers for reading
  const cleanText = content.value.replace(/\[.*?\]/g, '')
  
  utterance = new SpeechSynthesisUtterance(cleanText)
  utterance.rate = 1.1
  utterance.pitch = 1
  utterance.onend = () => { isReading.value = false }
  
  window.speechSynthesis.speak(utterance)
  isReading.value = true
}

const scoreClass = computed(() => {
  const score = feedback.value?.engagementScore || 0
  if (score >= 7) return 'score-high'
  if (score >= 4) return 'score-mid'
  return 'score-low'
})
let feedbackDebounce = null

async function loadScriptById(id) {
  loadingScript.value = true

  // Reset state when loading a new script
  feedback.value = null
  retentionData.value = []
  lastSaved.value = null
  editorMode.value = 'script'

  scriptId.value = id
  const loadedScript = await load(id)
  if (loadedScript) {
    content.value = loadedScript.content || ''
    setupAutoSave(id, content)

    // Load existing prediction if available
    if (loadedScript.prediction?.retentionCurve) {
      retentionData.value = loadedScript.prediction.retentionCurve
    }
  }
  loadingScript.value = false
}

onMounted(() => {
  loadScriptById(route.params.id)
})

// Watch for route changes to load different scripts
watch(() => route.params.id, (newId) => {
  if (newId) {
    loadScriptById(newId)
  }
})

// Debounced feedback on edit
watch(content, (newContent) => {
  if (feedbackDebounce) clearTimeout(feedbackDebounce)
  feedbackDebounce = setTimeout(async () => {
    if (newContent.length < 50) return
    savingFeedback.value = true
    feedback.value = await getFeedback(newContent, currentSection.value)
    if (feedback.value?.retentionPrediction) {
      // Generate a simple curve from the prediction
      const base = feedback.value.retentionPrediction
      retentionData.value = Array.from({ length: 10 }, (_, i) => {
        return Math.max(0, Math.min(100, base - (i * (100 - base) / 10) + Math.random() * 5))
      })
    }
    savingFeedback.value = false
  }, 3000)
})

const currentSection = ref('body')

function handleSectionChange(section) {
  currentSection.value = section
}

async function handleSave() {
  if (scriptId.value) {
    await save(scriptId.value, content.value)
    lastSaved.value = new Date().toLocaleTimeString()
    window.__toast?.('Script saved', 'success')
  }
}

function goToPredictions() {
  if (scriptId.value) {
    router.push(`/predictions/${scriptId.value}`)
  }
}

async function handlePosted() {
  if (!scriptId.value) return
  await scriptsStore.updateScript(scriptId.value, {
    posted: true,
    postedAt: new Date().toISOString()
  })
  window.__toast?.('Marked as posted!', 'success')
}
</script>

<template>
  <PageContainer>
    <div v-if="loadingScript" class="loading-state">
      <LoadingSkeleton width="200px" height="32px" />
      <LoadingSkeleton width="100%" height="500px" />
    </div>

    <template v-else-if="script">
      <div class="editor-header">
        <div class="header-left">
          <div class="title-row">
            <h1 class="editor-title">{{ script.topic || 'Untitled Script' }}</h1>
            <div class="mode-switch">
              <button 
                class="mode-btn" 
                :class="{ active: editorMode === 'script' }"
                @click="editorMode = 'script'"
              >
                Script
              </button>
              <button 
                class="mode-btn" 
                :class="{ active: editorMode === 'packaging' }"
                @click="editorMode = 'packaging'"
              >
                Packaging
              </button>
            </div>
          </div>
          <div class="editor-meta">
            <BaseBadge variant="default" size="sm">
              {{ new Date(script.updatedAt).toLocaleDateString() }}
            </BaseBadge>
            <BaseBadge v-if="lastSaved" variant="success" size="sm">
              Saved {{ lastSaved }}
            </BaseBadge>
            <BaseBadge v-if="savingFeedback" variant="info" size="sm">
              Analyzing...
            </BaseBadge>
            <BaseBadge v-if="script.posted" variant="success" size="sm">
              Posted {{ script.postedAt ? new Date(script.postedAt).toLocaleDateString() : '' }}
            </BaseBadge>
          </div>
        </div>
        <div class="editor-actions">
           <BaseButton 
              v-if="editorMode === 'script' && content"
              variant="ghost" 
              size="sm" 
              @click="toggleReadAloud"
              :class="{ 'pulse-text': isReading }"
            >
              <span v-if="isReading">🔊 Stop Reading</span>
              <span v-else>🔈 Read Aloud</span>
            </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="handleSave">Save</BaseButton>
          <BaseButton size="sm" @click="goToPredictions">View Predictions</BaseButton>
          <BaseButton
            v-if="!script.posted"
            size="sm"
            variant="success"
            @click="showChecklistModal = true"
          >
            Mark as Posted
          </BaseButton>
        </div>
      </div>

      <div class="editor-layout">
        <div class="editor-main" :class="{ 'full-width': editorMode === 'packaging' }">
          <ScriptEditor
            v-show="editorMode === 'script'"
            v-model="content"
            :feedback="feedback"
            @section-change="handleSectionChange"
          />
          <PackagingView 
            v-if="editorMode === 'packaging'" 
            :script="script"
          />
        </div>

        <aside class="editor-sidebar" v-if="editorMode === 'script'">
          <!-- Real-time Retention Preview -->
          <GlassCard v-if="retentionData.length" :hover="false" padding="md">
            <h4 class="sidebar-title">Retention Preview</h4>
            <RetentionChart :data="retentionData" :height="150" label="Predicted" />
          </GlassCard>

          <!-- Section Info -->
          <GlassCard :hover="false" padding="md">
            <h4 class="sidebar-title">Current Section</h4>
            <BaseBadge variant="accent" size="lg">{{ currentSection }}</BaseBadge>
            <p class="section-tip" v-if="currentSection === 'hook'">
              Keep your hook under 10 seconds. Make every word count.
            </p>
            <p class="section-tip" v-else-if="currentSection === 'intro'">
              Introduce the value proposition clearly. Why should viewers keep watching?
            </p>
            <p class="section-tip" v-else-if="currentSection === 'body'">
              Deliver on your promise. Use pattern interrupts to maintain attention.
            </p>
            <p class="section-tip" v-else-if="currentSection === 'cta'">
              Natural call-to-action. Relate it to the content they just watched.
            </p>
            <p class="section-tip" v-else-if="currentSection === 'outro'">
              End strong. Tease next content or provide a final takeaway.
            </p>
          </GlassCard>

          <!-- Engagement Score -->
          <GlassCard v-if="feedback" :hover="false" padding="md">
            <h4 class="sidebar-title">Engagement Score</h4>
            <div class="score-display">
              <span class="score-value" :class="scoreClass">
                {{ feedback.engagementScore || 0 }}
              </span>
              <span class="score-max">/10</span>
            </div>
          </GlassCard>
        </aside>
      </div>
    </template>

    <div v-else class="not-found">
      <GlassCard :hover="false" padding="lg">
        <h2>Script Not Found</h2>
        <p>This script doesn't exist or you don't have access.</p>
        <BaseButton @click="router.push('/generate')">Generate New Script</BaseButton>
      </GlassCard>
    </div>

    <PrePostChecklistModal
      v-model="showChecklistModal"
      @confirm="handlePosted"
    />
  </PageContainer>
</template>


<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.editor-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
}

.editor-meta {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.editor-actions {
  display: flex;
  gap: var(--space-sm);
}

.editor-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--space-xl);
}

.editor-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.sidebar-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.section-tip {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin-top: var(--space-sm);
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.score-value {
  font-size: var(--font-size-3xl);
  font-weight: 700;
}

.score-max {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.score-high { color: var(--color-success); }
.score-mid { color: var(--color-warning); }
.score-low { color: var(--color-error); }

.not-found {
  display: flex;
  justify-content: center;
  padding-top: var(--space-3xl);
  text-align: center;
}

.not-found h2 {
  margin-bottom: var(--space-sm);
}

.not-found p {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-lg);
}

@media (max-width: 1024px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }

  .editor-sidebar {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .editor-sidebar > * {
    flex: 1;
    min-width: 200px;
  }
}

.header-left {
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-xs);
  flex-wrap: wrap;
}

.mode-switch {
  display: flex;
  background: var(--color-bg-input);
  padding: 3px;
  border-radius: var(--radius-md);
}

.mode-btn {
  background: none;
  border: none;
  padding: 4px 12px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.mode-btn:hover {
  color: var(--color-text-primary);
}

.mode-btn.active {
  background: var(--color-bg-card);
  color: var(--color-accent);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.editor-main.full-width {
  grid-column: 1 / -1;
}

.pulse-text {
  color: var(--color-accent) !important;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>
