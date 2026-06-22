<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import PageContainer from '@/components/layout/PageContainer.vue'
import VueFeather from 'vue-feather'

const ideasStore = useIdeasStore()

// ── UI state ────────────────────────────────────────────────────
const openProjectId = ref(null)
const addingInCol = ref(null)
const newTaskText = ref('')
const dragTaskId = ref(null)
const dragOverCol = ref(null)
const ctxMenu = ref({ visible: false, x: 0, y: 0, taskId: null })
const editingTaskId = ref(null)
const editingTaskText = ref('')
const addInputRef = ref(null)
const editInputRef = ref(null)

// UPGRADE 4 — density toggle. Persisted in localStorage so the board
// remembers the choice across sessions.
const DENSITY_KEY = 'vh_tasks_density'
const density = ref(
  (typeof localStorage !== 'undefined' && localStorage.getItem(DENSITY_KEY)) || 'comfortable'
)
watch(density, (v) => {
  try { localStorage.setItem(DENSITY_KEY, v) } catch { /* ignore */ }
})

const COLUMNS = [
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
]

// Template refs used inside v-for become ARRAYS in Vue 3.
function focusRef(r) {
  const el = Array.isArray(r?.value) ? r.value[0] : r?.value
  el?.focus?.()
}

// ── Status mapping (tolerates any stored status) ────────────────
function taskStatus(task) {
  if (!task) return 'not_started'
  const s = task.status
  if (s === 'completed' || s === 'published' || task.completed) return 'completed'
  if (['in_progress', 'building', 'research', 'testing', 'filming', 'editing'].includes(s)) return 'in_progress'
  return 'not_started'
}

// ── Derived data (fully guarded) ────────────────────────────────
const projectsWithTasks = computed(() => {
  const ideas = Array.isArray(ideasStore.ideas) ? ideasStore.ideas : []
  return ideas
    .filter(idea => idea && Array.isArray(idea.subtasks) && idea.subtasks.length > 0)
    .map(idea => {
      const tasks = idea.subtasks.filter(Boolean)
      const done = tasks.filter(t => taskStatus(t) === 'completed').length
      return {
        id: idea.id,
        topic: idea.topic || 'Untitled project',
        type: idea.type,
        tasks,
        total: tasks.length,
        done,
        pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      }
    })
})

const openProject = computed(() =>
  projectsWithTasks.value.find(p => p.id === openProjectId.value) || null
)

watch([openProjectId, projectsWithTasks], () => {
  if (openProjectId.value && !openProject.value) {
    openProjectId.value = null
    resetTransientUi()
  }
})

function tasksForColumn(colId) {
  return openProject.value ? openProject.value.tasks.filter(t => taskStatus(t) === colId) : []
}

function typeLabel(type) {
  return { youtube: 'YouTube', electronics: 'Electronics', coding: 'Coding' }[type] || type || 'Project'
}
function typeIcon(type) {
  return { youtube: 'youtube', electronics: 'zap', coding: 'code' }[type] || 'folder'
}

// ── Navigation within the page ──────────────────────────────────
function resetTransientUi() {
  addingInCol.value = null
  newTaskText.value = ''
  editingTaskId.value = null
  editingTaskText.value = ''
  dragTaskId.value = null
  dragOverCol.value = null
  closeCtxMenu()
}
function openBoard(id) { resetTransientUi(); openProjectId.value = id }
function backToProjects() { resetTransientUi(); openProjectId.value = null }

// ── Add task ────────────────────────────────────────────────────
async function startAdd(colId) {
  addingInCol.value = colId
  newTaskText.value = ''
  await nextTick()
  focusRef(addInputRef)
}
function cancelAdd() {
  addingInCol.value = null
  newTaskText.value = ''
}
async function addTaskToColumn(colId) {
  const text = newTaskText.value.trim()
  const proj = openProject.value
  if (!text || !proj) return
  try {
    const created = await ideasStore.addSubtask(proj.id, text)
    if (created?.id) {
      await ideasStore.updateSubtask(proj.id, created.id, {
        status: colId,
        completed: colId === 'completed',
      })
    }
    newTaskText.value = ''
    await nextTick()
    focusRef(addInputRef)
  } catch (err) {
    console.error('Failed to add task:', err)
  }
}

// ── Edit / delete task ──────────────────────────────────────────
async function startEditTask(taskId) {
  closeCtxMenu()
  const task = openProject.value?.tasks.find(t => t.id === taskId)
  if (!task) return
  editingTaskId.value = taskId
  editingTaskText.value = task.text || ''
  await nextTick()
  focusRef(editInputRef)
}
async function commitEditTask(taskId) {
  if (editingTaskId.value !== taskId) return
  const text = editingTaskText.value.trim()
  const proj = openProject.value
  editingTaskId.value = null
  editingTaskText.value = ''
  if (!text || !proj) return
  try {
    await ideasStore.updateSubtask(proj.id, taskId, { text })
  } catch (err) {
    console.error('Failed to update task:', err)
  }
}
function cancelEditTask() {
  editingTaskId.value = null
  editingTaskText.value = ''
}
async function deleteTask(taskId) {
  closeCtxMenu()
  const proj = openProject.value
  if (!proj || !taskId) return
  if (!confirm('Delete this task?')) return
  try {
    await ideasStore.deleteSubtask(proj.id, taskId)
  } catch (err) {
    console.error('Failed to delete task:', err)
  }
}

// ── Dates ───────────────────────────────────────────────────────
async function updateTaskDate(taskId, field, value) {
  const proj = openProject.value
  if (!proj) return
  try {
    await ideasStore.updateSubtask(proj.id, taskId, { [field]: value || null })
  } catch (err) {
    console.error('Failed to update date:', err)
  }
}

// ── Drag and drop (UPGRADE 1 — lift state via dragTaskId) ───────
function onDragStart(taskId) { dragTaskId.value = taskId }
function onDragEnd() { dragTaskId.value = null; dragOverCol.value = null }
function onDragOver(colId, e) { e.preventDefault(); dragOverCol.value = colId }
async function onDrop(colId) {
  const taskId = dragTaskId.value
  const proj = openProject.value
  dragTaskId.value = null
  dragOverCol.value = null
  if (!taskId || !proj) return
  try {
    // The status change re-sorts the columns; <TransitionGroup> FLIPs the
    // card into its new position automatically.
    await ideasStore.updateSubtask(proj.id, taskId, {
      status: colId,
      completed: colId === 'completed',
    })
  } catch (err) {
    console.error('Failed to move task:', err)
  }
}

// ── Context menu ────────────────────────────────────────────────
function openCtxMenu(e, taskId) {
  e.preventDefault()
  const menuW = 150, menuH = 90
  ctxMenu.value = {
    visible: true,
    x: Math.min(e.clientX, window.innerWidth - menuW - 8),
    y: Math.min(e.clientY, window.innerHeight - menuH - 8),
    taskId,
  }
}
function closeCtxMenu() { ctxMenu.value = { visible: false, x: 0, y: 0, taskId: null } }

// ── Global listeners (always cleaned up) ────────────────────────
function onGlobalKeydown(e) {
  if (e.key === 'Escape') {
    closeCtxMenu()
    cancelEditTask()
    cancelAdd()
  }
}
function onGlobalClick() { closeCtxMenu() }

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('scroll', closeCtxMenu, true)
  try {
    await ideasStore.loadIdeas()
  } catch (err) {
    console.error('Failed to load ideas:', err)
  }
})

onBeforeUnmount(() => {
  closeCtxMenu()
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('scroll', closeCtxMenu, true)
})
</script>

<template>
  <div class="tasks-page" :class="{ compact: density === 'compact' }">
    <PageContainer title="Tasks" subtitle="Every project's tasks, organized by status">

      <!-- ── PROJECT CARDS ── -->
      <template v-if="!openProject">
        <div v-if="!projectsWithTasks.length" class="empty-state">
          <vue-feather type="check-square" class="empty-icon" />
          <p>No tasks yet.</p>
          <p class="empty-sub">Add tasks inside any project to see them here.</p>
        </div>

        <!-- UPGRADE 2 — staggered rise-in + animated progress -->
        <div v-else class="project-cards">
          <button v-for="(proj, i) in projectsWithTasks" :key="proj.id" class="project-card rise-in"
            :style="{ animationDelay: (i * 90) + 'ms' }" @click="openBoard(proj.id)">
            <div class="pc-icon" :data-type="proj.type">
              <vue-feather :type="typeIcon(proj.type)" size="20" />
            </div>
            <div class="pc-body">
              <span class="pc-name">{{ proj.topic }}</span>
              <span class="pc-type">{{ typeLabel(proj.type) }}</span>
            </div>
            <div class="pc-progress">
              <div class="pc-track">
                <div class="pc-fill" :style="{ width: proj.pct + '%' }" />
              </div>
              <span class="pc-pct">{{ proj.done }}/{{ proj.total }} · {{ proj.pct }}%</span>
            </div>
          </button>
        </div>
      </template>

      <!-- ── BOARD VIEW ── -->
      <template v-else>
        <div class="board-head">
          <button class="back-link" @click="backToProjects">
            <vue-feather type="arrow-left" size="16" /> All projects
          </button>

          <div class="board-head-row">
            <div class="board-title">
              <vue-feather :type="typeIcon(openProject.type)" size="16" />
              <span>{{ openProject.topic }}</span>
              <span class="board-type">{{ typeLabel(openProject.type) }}</span>
            </div>

            <!-- UPGRADE 4 — density toggle -->
            <div class="density-seg" role="group" aria-label="Card density">
              <button :class="{ on: density === 'comfortable' }" @click="density = 'comfortable'">
                Comfortable
              </button>
              <button :class="{ on: density === 'compact' }" @click="density = 'compact'">
                Compact
              </button>
            </div>
          </div>
        </div>

        <div class="board">
          <div v-for="col in COLUMNS" :key="col.id" class="board-col"
            :class="{ 'drag-over': dragOverCol === col.id }" @dragover="onDragOver(col.id, $event)"
            @dragleave="dragOverCol = null" @drop="onDrop(col.id)">
            <div class="col-head">
              <span class="col-label">{{ col.label }}</span>
              <span class="col-count">{{ tasksForColumn(col.id).length }}</span>
            </div>

            <div class="col-body">
              <!-- UPGRADE 1 — FLIP transitions: cards glide to their new
                   column/position when status changes -->
              <TransitionGroup name="task" tag="div" class="col-tasks">
                <div v-for="task in tasksForColumn(col.id)" :key="task.id" class="task-card"
                  :class="{ lift: dragTaskId === task.id }" :draggable="editingTaskId !== task.id"
                  @dragstart="onDragStart(task.id)" @dragend="onDragEnd"
                  @contextmenu="openCtxMenu($event, task.id)">
                  <input v-if="editingTaskId === task.id" ref="editInputRef" v-model="editingTaskText"
                    class="task-edit-input" @keydown.enter.prevent="commitEditTask(task.id)"
                    @keydown.escape="cancelEditTask" @blur="commitEditTask(task.id)" @mousedown.stop @click.stop />
                  <span v-else class="task-text">{{ task.text }}</span>
                  <!-- UPGRADE 4 — date row collapses smoothly in compact mode -->
                  <div class="task-date-row">
                    <input type="date" :value="task.startDate || ''"
                      @input="e => updateTaskDate(task.id, 'startDate', e.target.value)" @mousedown.stop @click.stop
                      class="task-date-input" />
                    <span class="task-date-sep">→</span>
                    <input type="date" :value="task.endDate || ''" :min="task.startDate || undefined"
                      @input="e => updateTaskDate(task.id, 'endDate', e.target.value)" @mousedown.stop @click.stop
                      class="task-date-input" :disabled="!task.startDate" />
                  </div>
                </div>
              </TransitionGroup>

              <!-- UPGRADE 3 — morphing add button: the button expands in
                   place into the input instead of swapping elements -->
              <div class="adder" :class="{ open: addingInCol === col.id }">
                <button class="adder-btn" @click="startAdd(col.id)">
                  <vue-feather type="plus" size="14" /> New task
                </button>
                <div class="adder-field">
                  <input ref="addInputRef" v-model="newTaskText" class="add-task-input"
                    :placeholder="`Add to ${col.label}…`" @keydown.enter.prevent="addTaskToColumn(col.id)"
                    @keydown.escape="cancelAdd" />
                  <div class="add-task-actions">
                    <button class="add-task-save" :disabled="!newTaskText.trim()"
                      @click="addTaskToColumn(col.id)">Add</button>
                    <button class="add-task-cancel" @click="cancelAdd">Done</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </PageContainer>

    <Transition name="ctx-fade">
      <div v-if="ctxMenu.visible" class="ctx-menu" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
        @click.stop>
        <button class="ctx-item" @click="startEditTask(ctxMenu.taskId)">
          <vue-feather type="edit-2" size="14" /> Edit
        </button>
        <button class="ctx-item ctx-item--danger" @click="deleteTask(ctxMenu.taskId)">
          <vue-feather type="trash-2" size="14" /> Delete
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tasks-page {
  display: block;
  width: 100%;
}

/* Reusable easing — ease-out-quart */
:where(.tasks-page) {
  --ease-quart: cubic-bezier(.22, .61, .36, 1);
}

/* ── UPGRADE 2: staggered rise-in ── */
@media (prefers-reduced-motion: no-preference) {
  .rise-in {
    opacity: 0;
    transform: translateY(10px);
    animation: rise .5s var(--ease-quart) forwards;
  }

  @keyframes rise {
    to {
      opacity: 1;
      transform: none;
    }
  }
}

/* ── Project cards ── */
.project-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-md);
}

.project-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast), transform var(--transition-fast);
  font: inherit;
}

.project-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.pc-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(127, 119, 221, 0.12);
  color: var(--color-accent);
}

.pc-icon[data-type="electronics"] {
  background: rgba(15, 157, 119, 0.12);
  color: #0F9D77;
}

.pc-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pc-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.pc-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.pc-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: 2px;
}

.pc-track {
  flex: 1;
  height: 5px;
  background: var(--color-bg-input);
  border-radius: 3px;
  overflow: hidden;
}

.pc-fill {
  height: 100%;
  width: 0;
  background: var(--color-accent);
  border-radius: 3px;
  /* UPGRADE 2 — slow settle on first paint */
  animation: fill-grow 1s var(--ease-quart) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .pc-fill {
    animation: none;
    width: var(--target, 0);
  }
}

@keyframes fill-grow {
  from {
    width: 0;
  }
}

.pc-pct {
  font-size: 10px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* ── Board head ── */
.board-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.board-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  padding: 0;
  align-self: flex-start;
}

.back-link:hover {
  color: var(--color-accent);
}

.board-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.board-type {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--color-border);
  padding: 2px 8px;
  border-radius: 20px;
}

/* ── UPGRADE 4: density segmented control ── */
.density-seg {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
}

.density-seg button {
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  background: none;
  border: 1px solid transparent;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: color .25s, background .25s, border-color .25s;
}

.density-seg button.on {
  color: var(--color-text-primary);
  background: rgba(127, 119, 221, 0.18);
  border-color: var(--color-accent);
}

/* ── Board columns ── */
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  align-items: start;
}

.board-col {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-sm);
  min-height: 120px;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.board-col.drag-over {
  border-color: var(--color-accent);
  background: rgba(127, 119, 221, 0.06);
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
}

.col-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-primary);
}

.col-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.col-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 40px;
}

.col-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.task-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  cursor: grab;
  /* UPGRADE 1 — smooth lift + settle */
  transition:
    box-shadow .2s,
    border-color .2s,
    padding .3s var(--ease-quart);
}

.task-card:active {
  cursor: grabbing;
}

.task-card:hover {
  border-color: var(--color-accent);
}

/* UPGRADE 1 — drag lift: subtle scale + tilt + shadow */
@media (prefers-reduced-motion: no-preference) {
  .task-card.lift {
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
    border-color: var(--color-accent);
    transform: scale(1.04) rotate(-1.2deg);
    opacity: .96;
  }
}

.task-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

/* UPGRADE 4 — date row, collapses in compact mode */
.task-date-row {
  display: flex;
  align-items: center;
  gap: 4px;
  max-height: 28px;
  opacity: 1;
  overflow: hidden;
  transition:
    max-height .3s var(--ease-quart),
    opacity .22s,
    margin-top .3s var(--ease-quart),
    transform .3s var(--ease-quart);
}

.tasks-page.compact .task-card {
  padding: 7px var(--space-sm);
}

.tasks-page.compact .task-date-row {
  max-height: 0;
  opacity: 0;
  margin-top: -4px;
  transform: translateY(-4px);
}

.task-date-input {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 10px;
  flex: 1;
  min-width: 0;
}

.task-date-input:disabled {
  opacity: 0.35;
}

.task-date-sep {
  font-size: 10px;
  color: var(--color-text-muted);
}

/* ── UPGRADE 1: TransitionGroup FLIP + enter/leave ── */
@media (prefers-reduced-motion: no-preference) {

  .task-move,
  .task-enter-active,
  .task-leave-active {
    transition:
      transform .42s var(--ease-quart),
      opacity .28s;
  }

  .task-enter-from {
    opacity: 0;
    transform: translateY(-8px) scale(.97);
  }

  .task-leave-to {
    opacity: 0;
    transform: scale(.96);
  }

  /* take leaving cards out of flow so siblings FLIP smoothly */
  .task-leave-active {
    position: absolute;
    width: calc(100% - var(--space-sm) * 2);
  }
}

/* ── Empty ── */
.empty-state {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.empty-icon {
  width: 2.5rem;
  height: 2.5rem;
  opacity: 0.6;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-sub {
  font-size: var(--font-size-sm);
  max-width: 300px;
}

@media (max-width: 640px) {
  .board {
    grid-template-columns: 1fr;
  }
}

/* ── UPGRADE 3: morphing add button ── */
.adder {
  position: relative;
  height: 38px;
  transition: height .28s var(--ease-quart);
}

.adder.open {
  height: 80px;
}

.adder-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: opacity .18s, border-color var(--transition-fast), color var(--transition-fast);
}

.adder-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.adder.open .adder-btn {
  opacity: 0;
  pointer-events: none;
}

.adder-field {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-accent);
  opacity: 0;
  transform: scale(.97);
  pointer-events: none;
  transition: opacity .22s .06s, transform .22s .06s var(--ease-quart);
}

.adder.open .adder-field {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.add-task-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--font-size-sm);
  outline: none;
}

.add-task-input:focus {
  border-color: var(--color-accent);
}

.add-task-actions {
  display: flex;
  gap: var(--space-xs);
  justify-content: flex-end;
}

.add-task-save,
.add-task-cancel {
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
}

.add-task-save {
  background: var(--color-accent);
  color: #000;
}

.add-task-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-task-cancel {
  background: none;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.add-task-cancel:hover {
  color: var(--color-text-primary);
}

.task-edit-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-input);
  border: 1px solid var(--color-accent);
  color: var(--color-text-primary);
  padding: 4px 6px;
  border-radius: 4px;
  font: inherit;
  font-size: var(--font-size-sm);
  outline: none;
}

/* ── Context menu ── */
.ctx-menu {
  position: fixed;
  z-index: 10001;
  min-width: 150px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  padding: 4px;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
}

.ctx-item:hover {
  background: rgba(127, 119, 221, 0.1);
}

.ctx-item--danger {
  color: var(--color-error, #ef4444);
}

.ctx-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.ctx-fade-enter-active {
  transition: opacity 0.1s, transform 0.1s;
}

.ctx-fade-leave-active {
  transition: opacity 0.08s;
}

.ctx-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.ctx-fade-leave-to {
  opacity: 0;
}
</style>