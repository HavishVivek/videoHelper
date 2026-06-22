<script setup>
import { computed, ref } from 'vue'
import { useIdeasStore, BOARD_COLUMNS, resolveSubtaskStatus } from '@/stores/ideas'
import BoardColumn from '../board/BoardColumn.vue'

const props = defineProps({
  ideaId:  { type: String, required: true },
  // Pass the existing task modal opener so board reuses it, never duplicates it
  onTaskClick: { type: Function, required: true },
})

const ideasStore = useIdeasStore()

// ── Task data ──────────────────────────────────────────────────────────────────
const idea = computed(() => ideasStore.ideas.find(i => i.id === props.ideaId))

// Subtasks enriched with resolved status (backwards-compatible with old data)
const tasks = computed(() =>
  (idea.value?.subtasks || []).map(t => ({
    ...t,
    status: resolveSubtaskStatus(t),
  }))
)

// Group tasks by column
const tasksByColumn = computed(() => {
  const map = {}
  for (const col of BOARD_COLUMNS) map[col.id] = []
  for (const task of tasks.value) {
    const col = map[task.status]
    if (col) col.push(task)
    else map['planning'].push(task) // unknown status → planning
  }
  return map
})

const totalTasks = computed(() => tasks.value.length)
const doneTasks  = computed(() => tasks.value.filter(t => t.status === 'published').length)

// ── Error state ────────────────────────────────────────────────────────────────
const moveError = ref('')

// ── Drag handler ───────────────────────────────────────────────────────────────
async function handleTaskMoved({ taskId, fromColumn, toColumn }) {
  if (fromColumn === toColumn) return  // reorder within column — no status change needed

  moveError.value = ''
  try {
    await ideasStore.updateSubtaskStatus(props.ideaId, taskId, toColumn)
  } catch (err) {
    moveError.value = 'Failed to save — changes rolled back.'
    console.error('[BoardView] drag update failed:', err)
  }
}
</script>

<template>
  <div class="board-view">

    <!-- Summary bar -->
    <div class="board-summary">
      <span class="summary-stat">
        <strong>{{ totalTasks }}</strong> tasks
      </span>
      <span class="summary-sep">·</span>
      <span class="summary-stat">
        <strong>{{ doneTasks }}</strong> published
      </span>
      <span v-if="totalTasks" class="summary-progress">
        <span class="prog-track">
          <span class="prog-fill" :style="{ width: (doneTasks / totalTasks * 100) + '%' }" />
        </span>
        <span class="prog-pct">{{ Math.round(doneTasks / totalTasks * 100) }}%</span>
      </span>
      <span v-if="moveError" class="move-error">⚠ {{ moveError }}</span>
    </div>

    <!-- Empty state (no subtasks at all) -->
    <div v-if="!totalTasks" class="board-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.25">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <p>No tasks yet</p>
      <p class="board-empty-sub">Add tasks in List View — they'll appear here automatically</p>
    </div>

    <!-- Board columns -->
    <div v-else class="board-scroll">
      <div class="board-columns">
        <BoardColumn
          v-for="col in BOARD_COLUMNS"
          :key="col.id"
          :column="col"
          :tasks="tasksByColumn[col.id]"
          @task-moved="handleTaskMoved"
          @task-click="onTaskClick"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
.board-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  /* Take up full remaining height so columns scroll correctly */
  min-height: 0;
}

/* Summary bar */
.board-summary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.summary-stat {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.summary-stat strong {
  color: var(--color-text-primary);
  font-weight: 700;
}

.summary-sep {
  color: var(--color-border);
}

.summary-progress {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: var(--space-xs);
}

.prog-track {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
}

.prog-fill {
  display: block;
  height: 100%;
  background: #22c55e;
  border-radius: 99px;
  transition: width 0.4s ease;
}

.prog-pct {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-text-muted);
}

.move-error {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: #f87171;
  font-weight: 600;
}

/* Empty state */
.board-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-2xl) var(--space-lg);
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.board-empty p { margin: 0; font-size: var(--font-size-sm); }
.board-empty-sub { font-size: var(--font-size-xs) !important; max-width: 280px; line-height: 1.5; opacity: 0.6; }

/* Horizontal scroll container */
.board-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: var(--space-md);
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.board-scroll::-webkit-scrollbar { height: 5px; }
.board-scroll::-webkit-scrollbar-track { background: transparent; }
.board-scroll::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 99px; }

.board-columns {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  min-width: max-content;
  padding: 2px 2px 4px;
}
</style>