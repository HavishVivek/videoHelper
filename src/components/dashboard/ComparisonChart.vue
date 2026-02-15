<script setup>
import RetentionChart from '@/components/ui/RetentionChart.vue'
import GlassCard from '@/components/ui/GlassCard.vue'

defineProps({
  retentionCurve: { type: Array, default: () => [] },
  averageCurve: { type: Array, default: () => [100, 75, 60, 52, 47, 43, 40, 38, 36, 34] }
})
</script>

<template>
  <GlassCard :hover="false" padding="lg">
    <h3 class="chart-title">Retention Comparison</h3>
    <p class="chart-subtitle">Predicted vs Channel Average</p>
    <RetentionChart
      :data="retentionCurve"
      :comparison-data="averageCurve"
      label="This Script"
      comparison-label="Channel Average"
      :height="220"
    />
  </GlassCard>
</template>

<style scoped>
.chart-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-xs);
}

.chart-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-lg);
}
</style>
