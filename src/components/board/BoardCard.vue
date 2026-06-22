<script setup>
import { computed } from 'vue'

const props = defineProps({
  task: { type: Object, required: true },
})

const emit = defineEmits(['click'])

const priorityConfig = {
  high:   { label: 'High',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  low:    { label: 'Low',    color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
}

const priority = computed(() => priorityConfig[props.task.priority] || null)

const dueDateLabel = computed(() => {
  const d = props.task.endDate || props.task.startDate
  if (!d) return null
  const date = new Date(d)
  const now = new Date()
  const diff = Math.ceil((date - now) / 86400000)
  const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (diff < 0)  return { label: formatted, overdue: true }
  if (diff === 0) return { label: 'Today', urgent: true }
  if (diff <= 3)  return { label: formatted, urgent: true }
  return { label: formatted }
})

const initials = computed(() => {
  if (!props.task.assignee) return null
  return props.task.assignee.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <div class="board-card" @click="emit('click', task)">
    <!-- Priority indicator strip -->
    <div v-if="priority" class="priority-strip" :style="{ background: priority.color }" />

    <div class="card-body">
      <!-- Title -->
      <p class="card-title">{{ task.text || task.title }}</p>

      <!-- Description preview -->
      <p v-if="task.description" class="card-desc">{{ task.description }}</p>

      <!-- Footer row -->
      <div class="card-footer">
        <!-- Due date -->
        <span
          v-if="dueDateLabel"
          class="due-badge"
          :class="{ overdue: dueDateLabel.overdue, urgent: dueDateLabel.urgent }"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {{ dueDateLabel.label }}
        </span>

        <!-- Priority badge -->
        <span v-if="priority" class="priority-badge" :style="{ color: priority.color, background: priority.bg }">
          {{ priority.label }}
        </span>

        <!-- Assignee avatar -->
        <span v-if="initials" class="assignee-avatar" :title="task.assignee">{{ initials }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-card {
  position: relative;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden;
  transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.15s ease;
  /* Needed for SortableJS ghost */
  user-select: none;
}

.board-card:hover {
  border-color: rgba(var(--color-accent-rgb, 99, 102, 241), 0.45);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
}

/* SortableJS classes applied automatically */
.board-card.sortable-ghost {
  opacity: 0.35;
  border: 2px dashed var(--color-accent);
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.06);
}

.board-card.sortable-drag {
  opacity: 0.95;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  transform: rotate(1.5deg) scale(1.02);
}

.priority-strip {
  height: 3px;
  width: 100%;
  flex-shrink: 0;
}

.card-body {
  padding: 10px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.card-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  margin: 0;
  word-break: break-word;
}

.card-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.due-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
}

.due-badge.urgent {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
}

.due-badge.overdue {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.08);
}

.priority-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.assignee-avatar {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.2);
  color: var(--color-accent);
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(var(--color-accent-rgb, 99, 102, 241), 0.3);
}
</style>