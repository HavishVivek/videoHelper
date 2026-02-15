<script setup>
import { ref, computed, watch } from 'vue'
import { wordCount, estimateReadingTime, parseScriptSections } from '@/utils/formatters'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  feedback: { type: Object, default: null },
  readonly: Boolean
})

const emit = defineEmits(['update:modelValue', 'section-change'])

const content = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const stats = computed(() => {
  const { words, minutes } = estimateReadingTime(content.value)
  return { words, minutes }
})

const sections = computed(() => parseScriptSections(content.value))

const currentSection = ref('body')

function handleInput(e) {
  content.value = e.target.value

  // Detect which section the cursor is in
  const text = e.target.value.substring(0, e.target.selectionStart)
  const markers = ['HOOK', 'INTRO', 'BODY', 'CTA', 'OUTRO']
  let detectedSection = 'body'
  for (const marker of markers) {
    if (text.toUpperCase().includes(`[${marker}]`)) {
      detectedSection = marker.toLowerCase()
    }
  }
  if (detectedSection !== currentSection.value) {
    currentSection.value = detectedSection
    emit('section-change', detectedSection)
  }
}

const feedbackVariant = computed(() => {
  if (!props.feedback) return 'default'
  const score = props.feedback.engagementScore || 0
  if (score >= 7) return 'success'
  if (score >= 4) return 'warning'
  return 'error'
})
</script>

<template>
  <div class="editor-wrapper">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <BaseBadge variant="default">{{ stats.words }} words</BaseBadge>
        <BaseBadge variant="default">~{{ stats.minutes }} min video</BaseBadge>
      </div>
      <div class="toolbar-right">
        <BaseBadge v-if="feedback" :variant="feedbackVariant">
          Score: {{ feedback.engagementScore || 0 }}/10
        </BaseBadge>
        <BaseBadge v-if="feedback?.pacing" :variant="feedback.pacing === 'good' ? 'success' : 'warning'">
          Pacing: {{ feedback.pacing }}
        </BaseBadge>
      </div>
    </div>

    <div class="editor-area">
      <textarea
        class="script-textarea"
        :value="content"
        :readonly="readonly"
        @input="handleInput"
        placeholder="Start writing your script..."
        spellcheck="true"
      />

      <div class="section-markers">
        <span
          v-for="(text, key) in sections"
          :key="key"
          class="section-marker"
          :class="{ active: currentSection === key, 'has-content': !!text }"
        >
          {{ key }}
        </span>
      </div>
    </div>

    <div class="feedback-panel" v-if="feedback?.suggestions?.length">
      <h4 class="feedback-title">Suggestions</h4>
      <ul class="suggestions-list">
        <li v-for="(suggestion, i) in feedback.suggestions" :key="i">
          {{ suggestion }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: var(--space-sm);
}

.editor-area {
  position: relative;
  display: flex;
  gap: var(--space-md);
}

.script-textarea {
  flex: 1;
  min-height: 500px;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  color: var(--color-text-primary);
  font-family: 'Inter', monospace;
  font-size: var(--font-size-sm);
  line-height: 1.8;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
}

.script-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.section-markers {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 80px;
}

.section-marker {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  background: var(--color-bg-card);
  text-align: center;
  transition: all var(--transition-fast);
}

.section-marker.active {
  background: var(--color-accent-glow);
  color: var(--color-accent);
}

.section-marker.has-content {
  color: var(--color-text-secondary);
}

.feedback-panel {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
}

.feedback-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-text-secondary);
}

.suggestions-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.suggestions-list li {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  padding-left: var(--space-md);
  position: relative;
}

.suggestions-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
}
</style>
