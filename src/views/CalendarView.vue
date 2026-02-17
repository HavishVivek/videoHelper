<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const store = useIdeasStore()
const currentDate = ref(new Date())

// Modal state
const showModal = ref(false)
const selectedDate = ref(null)
const assignStep = ref(1) // 1 = pick idea, 2 = pick type
const chosenIdea = ref(null)

onMounted(() => {
  store.loadIdeas()
})

const year = computed(() => currentDate.value.getFullYear())
const month = computed(() => currentDate.value.getMonth())
const monthName = computed(() => currentDate.value.toLocaleString('default', { month: 'long' }))

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
      // Script date range
      if (idea.scheduledScriptDate) {
        const start = idea.scheduledScriptDate
        const end = idea.scheduledScriptEndDate || start
        if (dateStr >= start && dateStr <= end) {
          events.push({
            type: 'script',
            title: idea.topic,
            isStart: dateStr === start,
            isEnd: dateStr === end,
            ideaId: idea.id
          })
        }
      }
      // Film date range
      if (idea.scheduledFilmDate) {
        const start = idea.scheduledFilmDate
        const end = idea.scheduledFilmEndDate || start
        if (dateStr >= start && dateStr <= end) {
          events.push({
            type: 'film',
            title: idea.topic,
            isStart: dateStr === start,
            isEnd: dateStr === end,
            ideaId: idea.id
          })
        }
      }
    })

    days.push({ day: i, dateStr, events })
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

function assignType(type) {
  if (!chosenIdea.value) return
  const field = type === 'film' ? 'scheduledFilmDate' : 'scheduledScriptDate'
  store.updateIdea(chosenIdea.value.id, { [field]: selectedDate.value })
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
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <PageContainer title="Content Calendar" subtitle="Plan your production schedule">
    <div class="calendar-header">
      <BaseButton @click="prevMonth" size="sm">← Prev</BaseButton>
      <div class="header-center">
        <h2>{{ monthName }} {{ year }}</h2>
        <button class="today-btn" @click="today">Today</button>
      </div>
      <BaseButton @click="nextMonth" size="sm">Next →</BaseButton>
    </div>

    <div class="legend">
      <span class="legend-item script">📝 Scripting</span>
      <span class="legend-item film">🎥 Filming</span>
    </div>

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
            'clickable': !!cell.day
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
            >
              <span v-if="event.isStart" class="event-icon">{{ event.type === 'script' ? '📝' : '🎥' }}</span>
              <span class="event-title">{{ event.isStart ? event.title : '&nbsp;' }}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>

    <!-- Assign Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <!-- Step 1: Pick idea -->
          <template v-if="assignStep === 1">
            <div class="modal-header">
              <h3>Assign an idea</h3>
              <p class="modal-date">{{ formatModalDate(selectedDate) }}</p>
              <button class="modal-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <div v-if="store.ideas.length === 0" class="modal-empty">
                No ideas yet. Add some ideas first.
              </div>
              <button
                v-for="idea in store.ideas"
                :key="idea.id"
                class="idea-option"
                @click="pickIdea(idea)"
              >
                {{ idea.topic }}
              </button>
            </div>
          </template>

          <!-- Step 2: Pick type -->
          <template v-else-if="assignStep === 2">
            <div class="modal-header">
              <h3>{{ chosenIdea?.topic }}</h3>
              <p class="modal-date">{{ formatModalDate(selectedDate) }}</p>
              <button class="modal-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <p class="type-prompt">What are you scheduling?</p>
              <div class="type-buttons">
                <button class="type-btn script" @click="assignType('script')">
                  <span class="type-icon">📝</span>
                  <span>Scripting</span>
                </button>
                <button class="type-btn film" @click="assignType('film')">
                  <span class="type-icon">🎥</span>
                  <span>Filming</span>
                </button>
              </div>
              <button class="back-btn" @click="assignStep = 1">← Back</button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </PageContainer>
</template>

<style scoped>
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.today-btn {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  padding: 2px 10px;
  border-radius: 12px;
  cursor: pointer;
}

.today-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.legend {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  font-size: var(--font-size-sm);
}

.legend-item.script {
  color: var(--color-accent);
}

.legend-item.film {
  color: #4caf50;
}

.calendar-card {
  overflow: hidden;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-sm) 0;
  text-align: center;
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(110px, auto);
}

.day-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-sm);
  position: relative;
  background: var(--color-bg-card);
  transition: background 0.15s;
}

.day-cell.clickable {
  cursor: pointer;
}

.day-cell.clickable:hover {
  background: rgba(255,255,255,0.04);
}

.day-cell:nth-child(7n) {
  border-right: none;
}

.day-cell.empty {
  background: rgba(0,0,0,0.2);
}

.day-number {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  position: absolute;
  top: 8px;
  right: 8px;
}

.events-list {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.event-pill {
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--color-accent-subtle);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 3px;
}

.event-pill.film {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
}

.event-pill.script {
  background: rgba(var(--color-accent-rgb), 0.2);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
}

/* Date range: middle days show as a continuous bar */
.event-pill.range-mid {
  border-radius: 0;
  opacity: 0.7;
}

.event-pill.range-start {
  border-radius: 4px 4px 4px 4px;
}

.event-pill.range-end {
  border-radius: 4px;
  opacity: 0.7;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 360px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: var(--color-text-primary);
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
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background 0.15s, border-color 0.15s;
}

.idea-option:hover {
  background: rgba(255,255,255,0.08);
  border-color: var(--color-accent);
}

.type-prompt {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.type-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  background: rgba(255,255,255,0.03);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.15s;
}

.type-btn .type-icon {
  font-size: 24px;
}

.type-btn.script:hover {
  border-color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.1);
}

.type-btn.film:hover {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.back-btn:hover {
  color: var(--color-text-primary);
}

@media (max-width: 768px) {
  .days-grid {
    grid-template-columns: repeat(7, 1fr);
    font-size: 10px;
  }
  .event-icon {
    display: none;
  }
}
</style>
