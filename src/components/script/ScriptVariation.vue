<template>
  <GlassCard 
    :class="['script-variation', { selected }]"
    @click="$emit('select')"
  >
    <div class="variation-header">
      <div class="style-badge-wrapper">
        <BaseBadge :variant="badgeVariant" size="sm">{{ variation.style }}</BaseBadge>
        <span class="estimated-length">~{{ variation.estimatedLength }} min</span>
      </div>
      <div v-if="selected" class="selected-indicator">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>

    <h3 class="variation-title">{{ variation.title || 'Script Variation' }}</h3>
    
    <p class="variation-tone">
      <strong>Tone:</strong> {{ variation.tone }}
    </p>

    <div class="script-preview">
      <pre>{{ previewContent }}</pre>
    </div>

    <div class="variation-footer">
      <BaseButton 
        v-if="!selected" 
        variant="ghost" 
        size="sm"
        @click.stop="toggleExpanded"
      >
        {{ expanded ? 'Show Less' : 'Read More' }}
      </BaseButton>
      <BaseButton 
        v-if="selected" 
        size="sm"
      >
        Selected ✓
      </BaseButton>
    </div>
  </GlassCard>
</template>

<script setup>
import { ref, computed } from 'vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const props = defineProps({
  variation: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])

const expanded = ref(false)

const badgeVariant = computed(() => {
  const style = props.variation.style?.toLowerCase() || ''
  if (style.includes('educational') || style.includes('tutorial')) return 'info'
  if (style.includes('entertaining') || style.includes('engaging')) return 'warning'
  if (style.includes('storytelling') || style.includes('narrative')) return 'accent'
  return 'default'
})

const previewContent = computed(() => {
  const content = props.variation.content || ''
  if (expanded.value || props.selected) {
    return content
  }
  // Show first 300 characters
  return content.length > 300 ? content.substring(0, 300) + '...' : content
})

function toggleExpanded() {
  expanded.value = !expanded.value
}
</script>

<style scoped>
.script-variation {
  cursor: pointer;
  transition: all var(--transition-base);
  border: 2px solid transparent;
}

.script-variation:hover {
  transform: translateY(-2px);
  border-color: var(--color-accent-muted);
}

.script-variation.selected {
  border-color: var(--color-accent);
  background: linear-gradient(
    135deg,
    rgba(var(--color-accent-rgb), 0.05),
    rgba(var(--color-accent-rgb), 0.02)
  );
}

.variation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.style-badge-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.estimated-length {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.selected-indicator {
  animation: scaleIn 0.3s ease-out;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.variation-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
}

.variation-tone {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

.script-preview {
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  max-height: 400px;
  overflow-y: auto;
}

.script-preview pre {
  font-family: 'Inter', monospace;
  font-size: var(--font-size-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--color-text-secondary);
  margin: 0;
}

.variation-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
