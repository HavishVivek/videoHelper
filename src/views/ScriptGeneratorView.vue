<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGroq } from '@/composables/useGroq'
import { useScriptsStore } from '@/stores/scripts'
import { useChannelStore } from '@/stores/channel'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import IntroOption from '@/components/script/IntroOption.vue'
import ScriptVariation from '@/components/script/ScriptVariation.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'

const router = useRouter()
const { generateIntros, generateScriptVariations, selectScriptVariation } = useGroq()
const scriptsStore = useScriptsStore()
const channelStore = useChannelStore()

const topic = ref('')
const notes = ref('')
const selectedIntroIndex = ref(-1)
const selectedVariationIndex = ref(-1)
const step = ref('topic') // topic | intros | variations | done
const finalizing = ref(false)

const introVariations = computed(() => scriptsStore.introVariations)
const scriptVariations = computed(() => scriptsStore.scriptVariations)
const loading = computed(() => scriptsStore.loading)
const error = computed(() => scriptsStore.error)

onMounted(() => {
  scriptsStore.introVariations = []
  scriptsStore.scriptVariations = []
  scriptsStore.error = null
  scriptsStore.loading = false
})

async function handleGenerateIntros() {
  if (!topic.value.trim()) return
  step.value = 'intros'
  await generateIntros(topic.value, notes.value)
}

function selectIntro(index) {
  selectedIntroIndex.value = index
}

async function handleGenerateVariations() {
  if (selectedIntroIndex.value < 0) return
  const intro = introVariations.value[selectedIntroIndex.value]
  step.value = 'variations'
  
  await generateScriptVariations(
    topic.value, 
    intro.introText || intro.intro_text || JSON.stringify(intro)
  )
}

function selectVariation(index) {
  selectedVariationIndex.value = index
}

async function handleFinalizeScript() {
  if (selectedVariationIndex.value < 0) return
  
  finalizing.value = true
  const intro = introVariations.value[selectedIntroIndex.value]
  const variation = scriptVariations.value[selectedVariationIndex.value]
  
  console.log('=== Finalizing Script ===')
  console.log('Topic:', topic.value)
  console.log('Intro:', intro)
  console.log('Variation:', variation)
  console.log('Variation content length:', variation?.content?.length)
  
  try {
    const result = await selectScriptVariation(
      topic.value,
      intro.introText || intro.intro_text || JSON.stringify(intro),
      variation.content
    )
    
    console.log('Result from selectScriptVariation:', result)
    
    // Ensure the script was created successfully
    if (result) {
      console.log('Script created successfully, transitioning to done')
      step.value = 'done'
    } else {
      console.error('selectScriptVariation returned null/undefined')
      window.__toast?.('Failed to create script. Please try again.', 'error')
    }
  } catch (error) {
    console.error('Error finalizing script:', error)
    console.error('Error stack:', error.stack)
    window.__toast?.(`An error occurred: ${error.message}`, 'error')
  } finally {
    finalizing.value = false
  }
}

function openEditor() {
  if (scriptsStore.currentScript?.id) {
    router.push(`/editor/${scriptsStore.currentScript.id}`)
  } else {
    console.error('No current script found')
    window.__toast?.('Script not found. Please try generating again.', 'error')
  }
}

function startOver() {
  topic.value = ''
  notes.value = ''
  selectedIntroIndex.value = -1
  selectedVariationIndex.value = -1
  step.value = 'topic'
  scriptsStore.introVariations = []
  scriptsStore.scriptVariations = []
}
</script>

<template>
  <PageContainer title="Script Generator" subtitle="Create AI-powered scripts based on your channel style">
    <!-- Step 1: Topic -->
    <div v-if="step === 'topic'" class="step-topic animate-fade-in-up">
      <GlassCard :hover="false" padding="lg" class="topic-card">
        <h2>What's your video about?</h2>

        <div v-if="!channelStore.channel" class="channel-notice">
          <BaseBadge variant="warning">No channel connected</BaseBadge>
          <p>Connect your channel first for personalized scripts.</p>
        </div>

        <BaseInput
          v-model="topic"
          label="Video Topic"
          placeholder="e.g., 10 JavaScript Tips Every Developer Should Know"
        />

        <BaseInput
          v-model="notes"
          label="Additional Notes (optional)"
          placeholder="Target audience, key points to cover, tone preferences..."
          textarea
          :rows="3"
        />

        <BaseButton
          size="lg"
          block
          @click="handleGenerateIntros"
          :loading="loading"
          :disabled="!topic.trim()"
        >
          Generate Intro Variations
        </BaseButton>
      </GlassCard>
    </div>

    <!-- Step 2: Intro Selection -->
    <div v-else-if="step === 'intros'" class="step-intros">
      <div class="step-header">
        <div>
          <h2>Choose Your Intro</h2>
          <p class="step-description">Topic: "{{ topic }}"</p>
        </div>
        <BaseButton variant="ghost" size="sm" @click="startOver">Start Over</BaseButton>
      </div>

      <div v-if="loading" class="loading-intros">
        <LoadingSkeleton v-for="i in 4" :key="i" width="100%" height="200px" />
      </div>

      <div v-else class="intros-grid">
        <IntroOption
          v-for="(intro, i) in introVariations"
          :key="i"
          :intro="intro"
          :selected="selectedIntroIndex === i"
          @select="selectIntro(i)"
        />
      </div>

      <div class="step-actions" v-if="!loading && introVariations.length">
        <BaseButton
          size="lg"
          @click="handleGenerateVariations"
          :disabled="selectedIntroIndex < 0"
        >
          Generate Script Variations
        </BaseButton>
      </div>

      <div v-if="!loading && !introVariations.length" class="empty-intros">
        <GlassCard :hover="false" padding="lg" class="empty-card">
          <p v-if="error" class="error-text">{{ error }}</p>
          <p v-else>No intro variations were generated. Try adjusting your topic or notes.</p>
          <BaseButton variant="secondary" @click="startOver">Try Again</BaseButton>
        </GlassCard>
      </div>
    </div>

    <!-- Step 3: Script Variations -->
    <div v-else-if="step === 'variations'" class="step-variations">
      <div class="step-header">
        <div>
          <h2>Choose Your Script Style</h2>
          <p class="step-description">Topic: "{{ topic }}"</p>
        </div>
        <BaseButton variant="ghost" size="sm" @click="startOver">Start Over</BaseButton>
      </div>

      <div v-if="loading" class="loading-variations">
        <LoadingSkeleton v-for="i in 3" :key="i" width="100%" height="400px" />
      </div>

      <div v-else class="variations-grid">
        <ScriptVariation
          v-for="(variation, i) in scriptVariations"
          :key="i"
          :variation="variation"
          :selected="selectedVariationIndex === i"
          @select="selectVariation(i)"
        />
      </div>

      <div class="step-actions" v-if="!loading && scriptVariations.length">
        <BaseButton
          size="lg"
          @click="handleFinalizeScript"
          :disabled="selectedVariationIndex < 0"
          :loading="finalizing"
        >
          {{ finalizing ? 'Saving Script...' : 'Finalize Script' }}
        </BaseButton>
      </div>

      <div v-if="!loading && !scriptVariations.length" class="empty-variations">
        <GlassCard :hover="false" padding="lg" class="empty-card">
          <p v-if="error" class="error-text">{{ error }}</p>
          <p v-else>No script variations were generated. Please try again.</p>
          <BaseButton variant="secondary" @click="step = 'intros'">Back to Intros</BaseButton>
        </GlassCard>
      </div>
    </div>

    <!-- Step 4: Done -->
    <div v-else-if="step === 'done'" class="step-done">
      <div class="step-header">
        <div>
          <h2>Script Ready! 🎉</h2>
          <p class="step-description">Topic: "{{ topic }}"</p>
        </div>
        <div class="step-header-actions">
          <BaseButton variant="secondary" size="sm" @click="startOver">New Script</BaseButton>
          <BaseButton size="sm" @click="openEditor">Open in Editor</BaseButton>
        </div>
      </div>

      <GlassCard :hover="false" padding="lg" class="success-card">
        <div class="success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3>Your script has been created!</h3>
        <p>Open it in the editor to refine, get AI feedback, and predict performance.</p>
        <div class="success-actions">
          <BaseButton size="lg" @click="openEditor">Open in Editor</BaseButton>
          <BaseButton variant="secondary" size="lg" @click="startOver">Create Another</BaseButton>
        </div>
      </GlassCard>
    </div>
  </PageContainer>
</template>

<style scoped>
.topic-card {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.topic-card h2 {
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.channel-notice {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: rgba(255, 152, 0, 0.05);
  border-radius: var(--radius-sm);
}

.channel-notice p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-xl);
}

.step-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
}

.step-header-actions {
  display: flex;
  gap: var(--space-sm);
}

.step-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-top: var(--space-xs);
}

.loading-intros {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-lg);
}

.intros-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-lg);
}

.step-actions {
  display: flex;
  justify-content: center;
  margin-top: var(--space-xl);
}

.empty-card {
  text-align: center;
  max-width: 400px;
  margin: var(--space-xl) auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.empty-card p {
  color: var(--color-text-secondary);
}

.error-text {
  color: var(--color-error) !important;
}

.script-preview {
  min-height: 300px;
}

.script-content pre {
  font-family: 'Inter', monospace;
  font-size: var(--font-size-sm);
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--color-text-secondary);
}

.streaming-indicator {
  display: flex;
  gap: 4px;
  padding-top: var(--space-md);
}

.dot {
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  animation: pulse 1.4s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

.loading-variations {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}

.variations-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.success-card {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.success-icon {
  animation: scaleIn 0.5s ease-out;
}

.success-card h3 {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin: 0;
}

.success-card p {
  color: var(--color-text-secondary);
  margin: 0;
}

.success-actions {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-md);
}

@media (max-width: 1200px) {
  .variations-grid,
  .loading-variations {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .intros-grid,
  .loading-intros {
    grid-template-columns: 1fr;
  }

  .success-actions {
    flex-direction: column;
    width: 100%;
  }
}
</style>
