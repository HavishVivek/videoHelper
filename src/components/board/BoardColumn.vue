<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Sortable from 'sortablejs'
import BoardCard from './BoardCard.vue'

const props = defineProps({
  column: { type: Object, required: true }, // { id, label, color }
  tasks:  { type: Array,  default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['task-moved', 'task-click'])

const listEl = ref(null)
let sortable = null

onMounted(() => {
  sortable = Sortable.create(listEl.value, {
    group: 'board',          // shared group = drag between columns
    animation: 160,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    chosenClass: 'sortable-chosen',
    // Only start drag on the card itself, not on click targets inside
    delay: 80,
    delayOnTouchOnly: true,

    onEnd(evt) {
      const taskId      = evt.item.dataset.taskId
      const fromColumn  = evt.from.dataset.columnId
      const toColumn    = evt.to.dataset.columnId
      const newIndex    = evt.newIndex

      // Always emit even if same column — order may have changed
      emit('task-moved', { taskId, fromColumn, toColumn, newIndex })
    },
  })
})

onBeforeUnmount(() => {
  sortable?.destroy()
})

// When tasks change externally (e.g. real-time update), SortableJS manages the
// DOM itself so we don't need to do anything — Vue's v-for keeps data in sync.
</script>

<template>
  <div class="board-column">
    <!-- Column header -->
    <div class="column-header">
      <div class="column-title-row">
        <span class="column-dot" :style="{ background: column.color }" />
        <span class="column-title">{{ column.label }}</span>
        <span class="column-count">{{ tasks.length }}</span>
      </div>
    </div>

    <!-- Cards list — SortableJS controls this element -->
    <div
      ref="listEl"
      class="column-cards"
      :data-column-id="column.id"
    >
      <div
        v-for="task in tasks"
        :key="task.id"
        :data-task-id="task.id"
      >
        <BoardCard :task="task" @click="emit('task-click', task)" />
      </div>

      <!-- Empty state -->
      <div v-if="!tasks.length && !loading" class="column-empty">
        <span>No tasks</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-column {
  display: flex;
  flex-direction: column;
  min-width: 260px;
  max-width: 280px;
  flex-shrink: 0;
  height: 100%;
}

/* Header */
.column-header {
  padding: 0 2px 10px;
  flex-shrink: 0;
}

.column-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.column-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-primary);
  flex: 1;
}

.column-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--color-border);
  padding: 1px 7px;
  border-radius: 20px;
  min-width: 22px;
  text-align: center;
}

/* Cards list */
.column-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 6px 16px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-height: 80px;
  overflow-y: auto;
  max-height: calc(100vh - 260px);
  transition: background 0.15s ease, border-color 0.15s ease;
}

/* Highlight when dragging over this column */
.column-cards.sortable-over {
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.05);
  border-color: rgba(var(--color-accent-rgb, 99, 102, 241), 0.3);
}

.column-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
  opacity: 0.5;
  pointer-events: none;
}
</style>