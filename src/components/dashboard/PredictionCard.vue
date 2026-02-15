<script setup>
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

defineProps({
  prediction: { type: Object, required: true }
})
</script>

<template>
  <GlassCard :hover="false" padding="lg">
    <div class="prediction-header">
      <h3>Performance Prediction</h3>
      <BaseBadge
        :variant="prediction.retentionPercent >= 60 ? 'success' : prediction.retentionPercent >= 40 ? 'warning' : 'error'"
        size="lg"
      >
        {{ prediction.retentionPercent }}% Retention
      </BaseBadge>
    </div>

    <div class="prediction-metrics">
      <div class="metric">
        <span class="metric-label">Engagement Score</span>
        <span class="metric-value">{{ prediction.engagementScore }}/10</span>
      </div>
      <div class="metric" v-if="prediction.similarVideo">
        <span class="metric-label">Similar To</span>
        <span class="metric-value similar">"{{ prediction.similarVideo }}"</span>
      </div>
    </div>

    <div class="drop-off-points" v-if="prediction.dropOffPoints?.length">
      <h4>Potential Drop-off Points</h4>
      <div
        v-for="(point, i) in prediction.dropOffPoints"
        :key="i"
        class="drop-off-item"
      >
        <BaseBadge variant="warning" size="sm">{{ point.timestamp || `Point ${i + 1}` }}</BaseBadge>
        <span>{{ point.reason }}</span>
      </div>
    </div>

    <div class="suggestions" v-if="prediction.suggestions?.length">
      <h4>Improvement Suggestions</h4>
      <ul>
        <li v-for="(s, i) in prediction.suggestions" :key="i">{{ s }}</li>
      </ul>
    </div>
  </GlassCard>
</template>

<style scoped>
.prediction-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
}

.prediction-header h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.prediction-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.metric {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.metric-label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-xs);
}

.metric-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.metric-value.similar {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.drop-off-points,
.suggestions {
  margin-bottom: var(--space-lg);
}

.drop-off-points h4,
.suggestions h4 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.drop-off-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.suggestions ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.suggestions li {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  padding-left: var(--space-md);
  position: relative;
}

.suggestions li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  background: var(--color-success);
  border-radius: 50%;
}
</style>
