<script setup>
defineProps({
  hover: { type: Boolean, default: true },
  padding: { type: String, default: 'md' }
})
</script>

<template>
  <div class="glass-card" :class="[`pad-${padding}`, { hoverable: hover }]">
    <slot />
  </div>
</template>

<style scoped>
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.glass-card.hoverable:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.pad-sm { padding: var(--space-md); }
.pad-md { padding: var(--space-lg); }
.pad-lg { padding: var(--space-xl); }
.pad-none { padding: 0; }
</style>
