<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  label: String,
  size: { type: Number, default: 120 },
  color: String
})

const percentage = computed(() => Math.min((props.value / props.max) * 100, 100))
const circumference = computed(() => 2 * Math.PI * 45)
const strokeDashoffset = computed(() => circumference.value * (1 - percentage.value / 100))

const gaugeColor = computed(() => {
  if (props.color) return props.color
  if (percentage.value >= 70) return 'var(--color-success)'
  if (percentage.value >= 40) return 'var(--color-warning)'
  return 'var(--color-error)'
})
</script>

<template>
  <div class="gauge" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 100 100">
      <circle
        class="gauge-bg"
        cx="50" cy="50" r="45"
        fill="none"
        stroke="var(--color-bg-card)"
        stroke-width="8"
      />
      <circle
        class="gauge-fill"
        cx="50" cy="50" r="45"
        fill="none"
        :stroke="gaugeColor"
        stroke-width="8"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        transform="rotate(-90 50 50)"
      />
    </svg>
    <div class="gauge-content">
      <span class="gauge-value">{{ Math.round(value) }}</span>
      <span class="gauge-label" v-if="label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.gauge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.gauge-fill {
  transition: stroke-dashoffset 1s ease, stroke 0.5s ease;
}

.gauge-content {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.gauge-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.gauge-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
