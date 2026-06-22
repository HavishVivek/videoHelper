<script setup>
import { computed } from 'vue'
import { useCountUp } from '@/composables/useCountUp'

const props = defineProps({
  pct: { type: Number, default: 0 },
  doneTasks: { type: Number, default: 0 },
  totalTasks: { type: Number, default: 0 },
  // only start counting/filling once the parent flips animateIn on
  animate: { type: Boolean, default: false },
  delay: { type: Number, default: 0 },
})

// ring circumference for r=16 → 2πr ≈ 100.5
const CIRC = 100.5

const target = computed(() => (props.animate ? props.pct : 0))

const livePct = useCountUp(() => target.value, { startDelay: props.delay })

const dashOffset = computed(() => CIRC - (CIRC * (props.animate ? props.pct : 0)) / 100)
</script>

<template>
  <div class="fp__progress-badge" aria-hidden="true">
    <svg class="fp__ring" viewBox="0 0 40 40">
      <circle class="fp__ring-track" cx="20" cy="20" r="16" />
      <circle class="fp__ring-prog" cx="20" cy="20" r="16" :style="{ strokeDashoffset: dashOffset }" />
    </svg>
    <div class="fp__progress-text">
      <span class="fp__progress-pct">{{ livePct }}%</span>
      <span class="fp__progress-left">
        {{ totalTasks ? `${doneTasks}/${totalTasks} tasks` : 'No tasks' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.fp__progress-badge {
  position: absolute;
  bottom: 4px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  background: var(--color-bg-card, var(--color-background-primary));
  border: 0.5px solid var(--accent-edge, #AFA9EC);
  border-radius: 99px;
  box-shadow: 0 4px 14px rgba(60, 52, 137, 0.12);
  opacity: 0;
  transform: translateX(-50%) translateY(8px) scale(0.9);
  transform-origin: bottom center;
  transition: opacity 0.25s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  z-index: 12;
}

:global(.fp:hover) .fp__progress-badge,
:global(.fp--open) .fp__progress-badge {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}

.fp__ring {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}

.fp__ring circle {
  fill: none;
  stroke-width: 5;
}

.fp__ring-track {
  stroke: var(--accent-soft, #EEEDFE);
}

.fp__ring-prog {
  stroke: var(--accent, #7F77DD);
  stroke-linecap: round;
  stroke-dasharray: 100.5 100.5;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.fp__progress-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.fp__progress-pct {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-deep, #534AB7);
}

.fp__progress-left {
  font-size: 10px;
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .fp__ring-prog {
    transition: none;
  }
}
</style>