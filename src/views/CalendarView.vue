<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const store = useIdeasStore()
const currentDate = ref(new Date())

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
  // Empty start slots
  for (let i = 0; i < firstDayOffset.value; i++) {
    days.push({ day: null })
  }
  // Days
  for (let i = 1; i <= daysInMonth.value; i++) {
    const dateStr = `${year.value}-${String(month.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    
    // Find events for this day
    const events = []
    store.ideas.forEach(idea => {
      if (idea.scheduledScriptDate === dateStr) {
        events.push({ type: 'script', title: idea.topic, color: 'accent' })
      }
      if (idea.scheduledFilmDate === dateStr) {
        events.push({ type: 'film', title: idea.topic, color: 'success' })
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
</script>

<template>
  <PageContainer title="Content Calendar" subtitle="Plan your production schedule">
    <div class="calendar-header">
      <BaseButton @click="prevMonth" size="sm" icon="chevron-left">Prev</BaseButton>
      <h2>{{ monthName }} {{ year }}</h2>
      <BaseButton @click="nextMonth" size="sm" icon="chevron-right">Next</BaseButton>
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
          :class="{ 'empty': !cell.day, 'has-events': cell.events && cell.events.length > 0 }"
        >
          <span v-if="cell.day" class="day-number">{{ cell.day }}</span>
          
          <div v-if="cell.day" class="events-list">
            <div 
              v-for="(event, eIndex) in cell.events" 
              :key="eIndex" 
              class="event-pill"
              :class="event.type"
            >
              <span class="event-icon">{{ event.type === 'script' ? '📝' : '🎥' }}</span>
              <span class="event-title">{{ event.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  </PageContainer>
</template>

<style scoped>
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
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
  /* Min height for rows */
  grid-auto-rows: minmax(120px, auto); 
}

.day-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-sm);
  position: relative;
  background: var(--color-bg-card);
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
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-pill {
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  background: var(--color-accent-subtle);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

.event-pill.film {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
}

.event-pill.script {
  background: rgba(var(--color-accent-rgb), 0.2);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
}

@media (max-width: 768px) {
  .days-grid {
    grid-template-columns: 1fr; /* Stack on mobile? No, keeping grid but smaller */
    grid-template-columns: repeat(7, 1fr);
    font-size: 10px;
  }
  .event-icon {
    display: none;
  }
}
</style>
