<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: v => ['default', 'success', 'warning', 'error', 'info', 'accent'].includes(v)
  },
  size: { type: String, default: 'md' }
})
</script>

<template>
  <span class="badge" :class="[`badge-${variant}`, `badge-${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-full);
  font-weight: 500;
  white-space: nowrap;
}

.badge-sm { padding: 2px 8px; font-size: var(--font-size-xs); }
.badge-md { padding: 4px 12px; font-size: var(--font-size-xs); }
.badge-lg { padding: 6px 16px; font-size: var(--font-size-sm); }

.badge-default { background: var(--color-bg-card); color: var(--color-text-secondary); }
.badge-success { background: rgba(76, 175, 80, 0.15); color: var(--color-success); }
.badge-warning { background: rgba(255, 152, 0, 0.15); color: var(--color-warning); }
.badge-error { background: rgba(244, 67, 54, 0.15); color: var(--color-error); }
.badge-info { background: rgba(33, 150, 243, 0.15); color: var(--color-info); }
.badge-accent { background: var(--color-accent-glow); color: var(--color-accent); }
</style>
