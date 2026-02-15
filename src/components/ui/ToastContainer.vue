<script setup>
import { ref, reactive } from 'vue'

const toasts = reactive([])
let toastId = 0

function addToast(message, type = 'info', duration = 4000) {
  const id = ++toastId
  toasts.push({ id, message, type })
  setTimeout(() => removeToast(id), duration)
}

function removeToast(id) {
  const idx = toasts.findIndex(t => t.id === id)
  if (idx > -1) toasts.splice(idx, 1)
}

// Expose globally
window.__toast = addToast

defineExpose({ addToast })
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast glass"
        :class="`toast-${toast.type}`"
        @click="removeToast(toast.id)"
      >
        <svg v-if="toast.type === 'success'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <svg v-else-if="toast.type === 'error'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <svg v-else-if="toast.type === 'warning'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: calc(var(--navbar-height) + var(--space-md));
  right: var(--space-lg);
  z-index: 300;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  pointer-events: all;
  min-width: 250px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
}

.toast-success { border-left: 3px solid var(--color-success); color: var(--color-success); }
.toast-error { border-left: 3px solid var(--color-error); color: var(--color-error); }
.toast-warning { border-left: 3px solid var(--color-warning); color: var(--color-warning); }
.toast-info { border-left: 3px solid var(--color-info); color: var(--color-info); }

.toast span { color: var(--color-text-primary); }

.toast-enter-active { animation: slideInLeft 250ms ease; }
.toast-leave-active { animation: fadeIn 150ms ease reverse; }
.toast-move { transition: transform 200ms ease; }
</style>
