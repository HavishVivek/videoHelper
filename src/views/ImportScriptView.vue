<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useScriptsStore } from '@/stores/scripts'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const router = useRouter()
const route = useRoute()
const scriptsStore = useScriptsStore()

const topic = ref('')
const content = ref('')
const importing = ref(false)
const ideaId = ref(null)

onMounted(() => {
  if (route.query.topic) topic.value = route.query.topic
  if (route.query.ideaId) ideaId.value = route.query.ideaId
})

async function handleImport() {
  if (!topic.value.trim() || !content.value.trim()) return

  importing.value = true
  try {
    const script = await scriptsStore.createManualScript(topic.value, content.value, ideaId.value)
    if (script && script.id) {
      router.push(`/editor/${script.id}`)
    } else {
      window.__toast?.('Failed to import script', 'error')
    }
  } catch (e) {
    console.error('Import error:', e)
    window.__toast?.('Failed to import script', 'error')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <PageContainer title="Import Script" subtitle="Analyze and improve your existing script">
    <div class="import-container animate-fade-in-up">
      <GlassCard :hover="false" padding="lg">
        <div class="form-group">
          <BaseInput
            v-model="topic"
            label="Video Topic"
            placeholder="What is your video about?"
            required
          />
        </div>

        <div class="form-group">
          <label class="label">Script Content *</label>
          <textarea
            v-model="content"
            class="script-input"
            placeholder="Paste your script here..."
            rows="15"
          ></textarea>
          <p v-if="content.trim()" class="char-count">{{ content.trim().length }} characters</p>
        </div>

        <div class="actions">
          <BaseButton variant="secondary" @click="router.back()">Cancel</BaseButton>
          <BaseButton
            @click="handleImport"
            :loading="importing"
            :disabled="!topic.trim() || !content.trim()"
          >
            Import & Analyze
          </BaseButton>
        </div>

        <p v-if="!topic.trim() || !content.trim()" class="hint-text">
          {{ !topic.trim() && !content.trim() ? 'Please fill in both the video topic and script content' :
             !topic.trim() ? 'Please enter a video topic to continue' :
             'Please paste your script content to continue' }}
        </p>
      </GlassCard>
    </div>
  </PageContainer>
</template>

<style scoped>
.import-container {
  max-width: 800px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: var(--space-lg);
}

.label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin-bottom: var(--space-xs);
  color: var(--color-text-secondary);
}

.script-input {
  width: 100%;
  padding: var(--space-md);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: 'Inter', monospace;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
}

.script-input:focus {
  border-color: var(--color-accent);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-top: var(--space-xl);
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.hint-text {
  font-size: var(--font-size-sm);
  color: var(--color-warning);
  text-align: center;
  margin-top: var(--space-md);
}
</style>
