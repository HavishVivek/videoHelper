<script setup>
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

defineProps({
  intro: { type: Object, required: true },
  selected: Boolean
})

defineEmits(['select'])
</script>

<template>
  <GlassCard
    class="intro-option"
    :class="{ selected }"
    @click="$emit('select')"
  >
    <div class="intro-header">
      <BaseBadge variant="accent">{{ intro.hookType }}</BaseBadge>
      <div class="intro-scores">
        <span class="score">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {{ intro.hookStrength }}/10
        </span>
        <span class="score retention">{{ intro.predictedRetention }}% retention</span>
      </div>
    </div>

    <p class="intro-text">{{ intro.introText }}</p>

    <p class="intro-explanation">{{ intro.explanation }}</p>

    <div class="intro-actions">
      <BaseButton
        :variant="selected ? 'primary' : 'secondary'"
        size="sm"
        @click.stop="$emit('select')"
      >
        {{ selected ? 'Selected' : 'Use This Intro' }}
      </BaseButton>
    </div>
  </GlassCard>
</template>

<style scoped>
.intro-option {
  cursor: pointer;
  padding: var(--space-lg);
  transition: all var(--transition-base);
}

.intro-option.selected {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.intro-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.intro-scores {
  display: flex;
  gap: var(--space-md);
}

.score {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.score.retention {
  color: var(--color-success);
  font-weight: 500;
}

.intro-text {
  font-size: var(--font-size-sm);
  line-height: 1.7;
  color: var(--color-text-primary);
  margin-bottom: var(--space-md);
  white-space: pre-wrap;
}

.intro-explanation {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
  font-style: italic;
}

.intro-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
