<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import { useAuthStore } from '@/stores/auth'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import VueFeather from 'vue-feather'

const store = useIdeasStore()
const authStore = useAuthStore()
const currentDate = ref(new Date())

// Modal state
const showModal = ref(false)
const selectedDate = ref(null)
const assignStep = ref(1) // 1 = pick idea, 2 = pick type
const chosenIdea = ref(null)

// Sync state
const lastSyncTime = ref(null)

onMounted(async () => {
  await store.loadIdeas()
  store.loadCalendarSettings()
})

// Auto-sync on date changes when enabled
watch(() => store.ideas, async (newIdeas, oldIdeas) => {
  if (!store.autoSyncEnabled || !store.googleCalendarId) return

  if (oldIdeas.length > 0) {
    for (let i = 0; i < newIdeas.length; i++) {
      const newIdea = newIdeas[i]
      const oldIdea = oldIdeas.find(o => o.id === newIdea.id)

      if (oldIdea) {
        const datesChanged =
          newIdea.scheduledScriptDate !== oldIdea.scheduledScriptDate ||
          newIdea.scheduledScriptEndDate !== oldIdea.scheduledScriptEndDate ||
          newIdea.scheduledFilmDate !== oldIdea.scheduledFilmDate ||
          newIdea.scheduledFilmEndDate !== oldIdea.scheduledFilmEndDate ||
          newIdea.scheduledPostDate !== oldIdea.scheduledPostDate

        if (datesChanged) {
          await store.syncSingleIdea(newIdea.id)
        }
      }
    }
  }
}, { deep: true })

const year = computed(() => currentDate.value.getFullYear())
const month = computed(() => currentDate.value.getMonth())
const monthName = computed(() => currentDate.value.toLocaleString('default', { month: 'long' }))

const todayStr = computed(() => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
})

// Calendar Logic
const daysInMonth = computed(() => new Date(year.value, month.value + 1, 0).getDate())
const firstDayOffset = computed(() => new Date(year.value, month.value, 1).getDay())

const calendarGrid = computed(() => {
  const days = []
  for (let i = 0; i < firstDayOffset.value; i++) {
    days.push({ day: null })
  }
  for (let i = 1; i <= daysInMonth.value; i++) {
    const dateStr = `${year.value}-${String(month.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`

    const events = []
    store.ideas.forEach(idea => {
      if (idea.scheduledScriptDate) {
        const start = idea.scheduledScriptDate
        const end = idea.scheduledScriptEndDate || start
        if (dateStr >= start && dateStr <= end) {
          events.push({ type: 'script', title: idea.topic, isStart: dateStr === start, isEnd: dateStr === end, ideaId: idea.id })
        }
      }
      if (idea.scheduledFilmDate) {
        const start = idea.scheduledFilmDate
        const end = idea.scheduledFilmEndDate || start
        if (dateStr >= start && dateStr <= end) {
          events.push({ type: 'film', title: idea.topic, isStart: dateStr === start, isEnd: dateStr === end, ideaId: idea.id })
        }
      }
      if (idea.scheduledPostDate && idea.scheduledPostDate === dateStr) {
        events.push({ type: 'post', title: idea.topic, isStart: true, isEnd: true, ideaId: idea.id })
      }
      if (idea.subtasks) {
        idea.subtasks.forEach(subtask => {
          if (subtask.startDate) {
            const start = subtask.startDate
            const end = subtask.endDate || start
            if (dateStr >= start && dateStr <= end) {
              events.push({ type: 'subtask', title: subtask.text, isStart: dateStr === start, isEnd: dateStr === end, ideaId: idea.id })
            }
          }
        })
      }
    })

    days.push({ day: i, dateStr, events, isToday: dateStr === todayStr.value })
  }
  return days
})

function prevMonth() {
  currentDate.value = new Date(year.value, month.value - 1, 1)
}
function nextMonth() {
  currentDate.value = new Date(year.value, month.value + 1, 1)
}
function today() {
  currentDate.value = new Date()
}

// Icon name per event type (Feather names, matching IdeaFolder.vue)
function eventIcon(type) {
  return type === 'script' ? 'file-text'
    : type === 'film' ? 'video'
    : type === 'post' ? 'tv'
    : 'check-square'
}

// Modal actions
function openAssignModal(cell) {
  if (!cell.day) return
  selectedDate.value = cell.dateStr
  assignStep.value = 1
  chosenIdea.value = null
  showModal.value = true
}
function pickIdea(idea) {
  chosenIdea.value = idea
  assignStep.value = 2
}
async function assignType(type) {
  if (!chosenIdea.value) return
  const field = type === 'film' ? 'scheduledFilmDate' : type === 'post' ? 'scheduledPostDate' : 'scheduledScriptDate'
  await store.updateIdea(chosenIdea.value.id, { [field]: selectedDate.value })
  closeModal()
}
function closeModal() {
  showModal.value = false
  selectedDate.value = null
  chosenIdea.value = null
  assignStep.value = 1
}
function formatModalDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Sync functions
async function handleSync() {
  const success = await store.syncToGoogleCalendar()
  if (success) lastSyncTime.value = new Date()
}
async function handlePullFromCalendar() {
  const success = await store.pullFromGoogleCalendar()
  if (success) lastSyncTime.value = new Date()
}
function toggleAutoSync() {
  if (store.autoSyncEnabled) store.disableAutoSync()
  else store.enableAutoSync()
}

const syncState = computed(() => {
  if (store.syncing) return { label: 'Syncing…', tone: 'busy', icon: 'refresh-cw' }
  if (!authStore.accessToken) return { label: 'Sign in to sync', tone: 'warn', icon: 'alert-triangle' }
  if (!store.googleCalendarId) return { label: 'Not synced', tone: 'idle', icon: 'calendar' }
  if (store.autoSyncEnabled) return { label: 'Auto-sync on', tone: 'ok', icon: 'check' }
  return { label: 'Synced', tone: 'ok', icon: 'check' }
})

const canSync = computed(() => authStore.accessToken && !store.syncing)

const needsReauth = computed(() => {
  const error = store.syncError?.toLowerCase() || ''
  return error.includes('token expired') || error.includes('sign out') || error.includes('permission')
})

async function handleReauth() {
  await authStore.logout()
  store.syncError = null
}
</script>

<template>
  <PageContainer title="Content Calendar" subtitle="Plan your production schedule">
    <!-- Month navigation -->
    <div class="calendar-header">
      <button class="nav-btn" @click="prevMonth" aria-label="Previous month">
        <vue-feather type="chevron-left" size="18" />
      </button>
      <div class="header-center">
        <h2 class="month-title">{{ monthName }} <span class="year">{{ year }}</span></h2>
        <button class="today-btn" @click="today">Today</button>
      </div>
      <button class="nav-btn" @click="nextMonth" aria-label="Next month">
        <vue-feather type="chevron-right" size="18" />
      </button>
    </div>

    <!-- Google Calendar Sync Panel -->
    <GlassCard class="sync-panel">
      <div class="sync-header">
        <div class="sync-status">
          <span class="status-badge" :class="syncState.tone">
            <vue-feather :type="syncState.icon" size="14" :class="{ spin: syncState.tone === 'busy' }" />
            {{ syncState.label }}
          </span>
          <span v-if="lastSyncTime" class="last-sync">
            <vue-feather type="clock" size="12" />
            Last synced {{ new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
          </span>
        </div>
        <div class="sync-actions">
          <BaseButton
            v-if="!store.googleCalendarId"
            @click="handleSync"
            :disabled="!canSync"
            size="sm"
            variant="primary"
          >
            <vue-feather type="calendar" size="15" /> Sync to Google Calendar
          </BaseButton>
          <template v-else>
            <BaseButton @click="handlePullFromCalendar" :disabled="!canSync" size="sm">
              <vue-feather type="arrow-down" size="15" /> Pull
            </BaseButton>
            <BaseButton @click="handleSync" :disabled="!canSync" size="sm">
              <vue-feather type="arrow-up" size="15" /> Push
            </BaseButton>
            <button
              class="auto-sync-toggle"
              :class="{ active: store.autoSyncEnabled }"
              @click="toggleAutoSync"
            >
              <vue-feather :type="store.autoSyncEnabled ? 'play' : 'pause'" size="14" />
              {{ store.autoSyncEnabled ? 'Auto-sync on' : 'Auto-sync off' }}
            </button>
          </template>
        </div>
      </div>

      <div v-if="store.syncError" class="sync-error">
        <span class="sync-error-msg">
          <vue-feather type="alert-triangle" size="15" /> {{ store.syncError }}
        </span>
        <BaseButton
          v-if="needsReauth"
          @click="handleReauth"
          size="sm"
          variant="secondary"
          class="reauth-btn"
        >
          <vue-feather type="log-out" size="14" /> Sign out & reconnect
        </BaseButton>
      </div>

      <div v-if="!authStore.accessToken" class="sync-hint">
        Sign in with Google to sync your calendar.
      </div>
      <div v-else-if="!store.googleCalendarId" class="sync-hint">
        Sync creates a “YouTube Production Schedule” calendar in your Google account.
      </div>
      <div v-else-if="store.autoSyncEnabled" class="sync-hint">
        Date changes sync to Google Calendar automatically.
      </div>
    </GlassCard>

    <!-- Legend -->
    <div class="legend">
      <span class="legend-item script"><vue-feather type="file-text" size="14" /> Scripting</span>
      <span class="legend-item film"><vue-feather type="video" size="14" /> Filming</span>
      <span class="legend-item post"><vue-feather type="tv" size="14" /> Post</span>
      <span class="legend-item subtask"><vue-feather type="check-square" size="14" /> Subtask</span>
    </div>

    <!-- Calendar grid -->
    <GlassCard padding="none" class="calendar-card">
      <div class="weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>

      <div class="days-grid">
        <div
          v-for="(cell, i) in calendarGrid"
          :key="i"
          class="day-cell"
          :class="{
            'empty': !cell.day,
            'has-events': cell.events && cell.events.length > 0,
            'clickable': !!cell.day,
            'is-today': cell.isToday
          }"
          @click="openAssignModal(cell)"
        >
          <span v-if="cell.day" class="day-number">{{ cell.day }}</span>

          <div v-if="cell.day" class="events-list">
            <div
              v-for="(event, eIndex) in cell.events"
              :key="eIndex"
              class="event-pill"
              :class="[event.type, { 'range-start': event.isStart, 'range-end': event.isEnd, 'range-mid': !event.isStart && !event.isEnd }]"
              :title="event.title"
            >
              <vue-feather v-if="event.isStart" :type="eventIcon(event.type)" size="11" class="event-icon" />
              <span class="event-title">{{ event.isStart ? event.title : '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>

    <!-- Assign Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
          <div class="modal">
            <!-- Step 1: Pick idea -->
            <template v-if="assignStep === 1">
              <div class="modal-header">
                <h3>Assign an idea</h3>
                <p class="modal-date">{{ formatModalDate(selectedDate) }}</p>
                <button class="modal-close" @click="closeModal" aria-label="Close">
                  <vue-feather type="x" size="18" />
                </button>
              </div>
              <div class="modal-body">
                <div v-if="store.ideas.length === 0" class="modal-empty">
                  No ideas yet — add some ideas first.
                </div>
                <button
                  v-for="idea in store.ideas"
                  :key="idea.id"
                  class="idea-option"
                  @click="pickIdea(idea)"
                >
                  <span>{{ idea.topic }}</span>
                  <vue-feather type="chevron-right" size="16" class="idea-chevron" />
                </button>
              </div>
            </template>

            <!-- Step 2: Pick type -->
            <template v-else-if="assignStep === 2">
              <div class="modal-header">
                <h3>{{ chosenIdea?.topic }}</h3>
                <p class="modal-date">{{ formatModalDate(selectedDate) }}</p>
                <button class="modal-close" @click="closeModal" aria-label="Close">
                  <vue-feather type="x" size="18" />
                </button>
              </div>
              <div class="modal-body">
                <p class="type-prompt">What are you scheduling?</p>
                <div class="type-buttons">
                  <button class="type-btn script" @click="assignType('script')">
                    <vue-feather type="file-text" size="22" class="type-icon" />
                    <span>Scripting</span>
                  </button>
                  <button class="type-btn film" @click="assignType('film')">
                    <vue-feather type="video" size="22" class="type-icon" />
                    <span>Filming</span>
                  </button>
                  <button class="type-btn post" @click="assignType('post')">
                    <vue-feather type="tv" size="22" class="type-icon" />
                    <span>Post date</span>
                  </button>
                </div>
                <button class="back-btn" @click="assignStep = 1">
                  <vue-feather type="chevron-left" size="15" /> Back
                </button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </PageContainer>
</template>

<style scoped>
/* ── Month navigation ───────────────────────────── */
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.nav-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.08);
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.month-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.month-title .year {
  color: var(--color-text-muted);
  font-weight: 400;
}
.today-btn {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  padding: 3px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.today-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* ── Sync panel ─────────────────────────────────── */
.sync-panel {
  margin-bottom: var(--space-md);
}
.sync-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}
.sync-status {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 999px;
  width: fit-content;
  border: 1px solid transparent;
}
.status-badge.ok {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.25);
}
.status-badge.warn {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.25);
}
.status-badge.busy {
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.1);
  border-color: rgba(var(--color-accent-rgb), 0.25);
}
.status-badge.idle {
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border);
}
.last-sync {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.sync-actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  flex-wrap: wrap;
}
.auto-sync-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 7px 13px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}
.auto-sync-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--color-accent);
}
.auto-sync-toggle.active {
  background: rgba(var(--color-accent-rgb), 0.18);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.sync-error {
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: #fca5a5;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  justify-content: space-between;
  flex-wrap: wrap;
}
.sync-error-msg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.reauth-btn { flex-shrink: 0; }

.sync-hint {
  margin-top: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ── Legend ─────────────────────────────────────── */
.legend {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  font-size: var(--font-size-sm);
  flex-wrap: wrap;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend-item.script { color: var(--color-accent); }
.legend-item.film { color: #4caf50; }
.legend-item.post { color: #f59e0b; }
.legend-item.subtask { color: #a78bfa; }

/* feather icons align cleanly with adjacent text */
.status-badge .vue-feather,
.last-sync .vue-feather,
.legend-item .vue-feather,
.sync-error-msg .vue-feather,
.event-pill .vue-feather,
.back-btn .vue-feather,
.idea-option .vue-feather {
  vertical-align: middle;
}

/* ── Calendar grid ──────────────────────────────── */
.calendar-card { overflow: hidden; }

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-sm) 0;
  text-align: center;
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(112px, auto);
}

.day-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-sm);
  position: relative;
  background: var(--color-bg-card);
  transition: background 0.15s ease;
}
.day-cell.clickable { cursor: pointer; }
.day-cell.clickable:hover { background: rgba(255, 255, 255, 0.04); }
.day-cell:nth-child(7n) { border-right: none; }
.day-cell.empty { background: rgba(0, 0, 0, 0.18); }

.day-cell.is-today {
  background: rgba(var(--color-accent-rgb), 0.06);
  box-shadow: inset 0 0 0 1.5px rgba(var(--color-accent-rgb), 0.45);
}

.day-number {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  position: absolute;
  top: 8px;
  right: 8px;
}
.day-cell.is-today .day-number {
  color: var(--color-accent);
  font-weight: 700;
  background: rgba(var(--color-accent-rgb), 0.2);
  border-radius: 999px;
  min-width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  top: 6px;
  right: 6px;
}

.events-list {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.event-pill {
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 5px;
  background: var(--color-accent-subtle);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.4;
}
.event-pill .event-icon { flex-shrink: 0; }
.event-pill .event-title {
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-pill.script {
  background: rgba(var(--color-accent-rgb), 0.18);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
}
.event-pill.film {
  background: rgba(76, 175, 80, 0.18);
  border: 1px solid rgba(76, 175, 80, 0.4);
}
.event-pill.post {
  background: rgba(245, 158, 11, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.4);
}
.event-pill.subtask {
  background: rgba(167, 139, 250, 0.18);
  border: 1px solid rgba(167, 139, 250, 0.4);
}

/* Date ranges: seamless bar across days */
.event-pill.range-start {
  border-radius: 5px 0 0 5px;
  border-right: none;
}
.event-pill.range-mid {
  border-radius: 0;
  border-left: none;
  border-right: none;
  opacity: 0.75;
}
.event-pill.range-end {
  border-radius: 0 5px 5px 0;
  border-left: none;
  opacity: 0.75;
}
/* single-day events keep full rounding */
.event-pill.range-start.range-end {
  border-radius: 5px;
  border: 1px solid;
}

/* ── Modal ──────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-md);
}
.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 380px;
  max-width: 100%;
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
.modal-header {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  position: relative;
}
.modal-header h3 {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin-bottom: 4px;
  padding-right: var(--space-lg);
}
.modal-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.modal-close {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  line-height: 1;
  display: flex;
  border-radius: var(--radius-sm);
  padding: 2px;
  transition: all 0.15s ease;
}
.modal-close:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}
.modal-body {
  padding: var(--space-md);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.modal-empty {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--space-lg);
}
.idea-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.15s ease;
}
.idea-option:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--color-accent);
}
.idea-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.idea-option:hover .idea-chevron { color: var(--color-accent); }

.type-prompt {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}
.type-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-sm);
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.15s ease;
}
.type-btn .type-icon { color: var(--color-text-secondary); transition: color 0.15s ease; }
.type-btn.script:hover {
  border-color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.1);
}
.type-btn.script:hover .type-icon { color: var(--color-accent); }
.type-btn.film:hover {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}
.type-btn.film:hover .type-icon { color: #4caf50; }
.type-btn.post:hover {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}
.type-btn.post:hover .type-icon { color: #f59e0b; }

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0;
  text-align: left;
  transition: color 0.15s ease;
}
.back-btn:hover { color: var(--color-text-primary); }

/* ── Animations ─────────────────────────────────── */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal { transition: transform 0.18s ease; }
.modal-fade-enter-from .modal { transform: scale(0.96); }

@media (prefers-reduced-motion: reduce) {
  .spin { animation: none; }
  .modal-fade-enter-active,
  .modal-fade-leave-active { transition: none; }
}

@media (max-width: 768px) {
  .days-grid {
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: minmax(84px, auto);
    font-size: 10px;
  }
  .event-icon { display: none; }
  .sync-header { flex-direction: column; align-items: stretch; }
  .sync-actions { justify-content: flex-start; }
}
</style>