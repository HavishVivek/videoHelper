<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'
import PageContainer from '@/components/layout/PageContainer.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const router = useRouter()
const store = useIdeasStore()

const newTopic = ref('')

onMounted(() => {
  store.loadIdeas()
})

async function handleAddIdea() {
  if (!newTopic.value.trim()) return
  await store.addIdea(newTopic.value.trim())
  newTopic.value = ''
}

function convertToScript(idea) {
  router.push({ name: 'ScriptGenerator', query: { topic: idea.topic } })
}

function updateDate(idea, field, event) {
  store.updateIdea(idea.id, { [field]: event.target.value })
}

function handleDelete(id) {
  if (confirm('Delete this idea?')) {
    store.deleteIdea(id)
  }
}
</script>

<template>
  <PageContainer title="Ideas Board" subtitle="Brainstorm and schedule your next viral videos">
    
    <!-- Add Idea Section -->
    <section class="add-section">
      <GlassCard padding="lg">
        <form @submit.prevent="handleAddIdea" class="add-form">
          <BaseInput 
            v-model="newTopic" 
            placeholder="Enter a video topic (e.g. 'Day in the life of a coder')..." 
            class="topic-input"
          />
          <BaseButton type="submit" size="lg" icon="plus">Add Idea</BaseButton>
        </form>
      </GlassCard>
    </section>

    <!-- Ideas List -->
    <section class="ideas-list">
      <div v-if="store.loading" class="loading">Loading ideas...</div>
      
      <div v-else-if="store.ideas.length === 0" class="empty-state">
        <h3>No ideas yet</h3>
        <p>Start brainstorming above!</p>
      </div>

      <div v-else class="grid">
        <GlassCard 
          v-for="idea in store.ideas" 
          :key="idea.id" 
          class="idea-card"
          padding="md"
        >
          <div class="card-header">
            <h3 class="topic">{{ idea.topic }}</h3>
            <button @click="handleDelete(idea.id)" class="delete-btn" title="Delete">×</button>
          </div>

          <div class="schedule-section">
            <div class="date-range-field">
              <span class="date-range-label">📝 Scripting</span>
              <div class="date-range-inputs">
                <input
                  type="date"
                  :value="idea.scheduledScriptDate"
                  @input="e => updateDate(idea, 'scheduledScriptDate', e)"
                  class="date-input"
                  title="Start date"
                />
                <span class="range-sep">→</span>
                <input
                  type="date"
                  :value="idea.scheduledScriptEndDate"
                  :min="idea.scheduledScriptDate"
                  @input="e => updateDate(idea, 'scheduledScriptEndDate', e)"
                  class="date-input"
                  title="End date (optional)"
                  :disabled="!idea.scheduledScriptDate"
                />
              </div>
            </div>
            <div class="date-range-field">
              <span class="date-range-label">🎥 Filming</span>
              <div class="date-range-inputs">
                <input
                  type="date"
                  :value="idea.scheduledFilmDate"
                  @input="e => updateDate(idea, 'scheduledFilmDate', e)"
                  class="date-input"
                  title="Start date"
                />
                <span class="range-sep">→</span>
                <input
                  type="date"
                  :value="idea.scheduledFilmEndDate"
                  :min="idea.scheduledFilmDate"
                  @input="e => updateDate(idea, 'scheduledFilmEndDate', e)"
                  class="date-input"
                  title="End date (optional)"
                  :disabled="!idea.scheduledFilmDate"
                />
              </div>
            </div>
          </div>

          <div class="card-actions">
            <BaseButton 
              size="sm" 
              variant="secondary" 
              class="action-btn"
              @click="convertToScript(idea)"
            >
              Write Script
            </BaseButton>
          </div>
        </GlassCard>
      </div>
    </section>

  </PageContainer>
</template>

<style scoped>
.add-section {
  margin-bottom: var(--space-xl);
}

.add-form {
  display: flex;
  gap: var(--space-md);
}

.topic-input {
  flex: 1;
}

.ideas-list {
  margin-top: var(--space-xl);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.idea-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.topic {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  margin-right: var(--space-sm);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.delete-btn:hover {
  color: var(--color-error);
}

.schedule-section {
  margin-top: auto;
  margin-bottom: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  background: rgba(0,0,0,0.2);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
}

.date-range-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-range-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 600;
}

.date-range-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.range-sep {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.date-input {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 4px 6px;
  border-radius: 4px;
  font-family: inherit;
  font-size: var(--font-size-sm);
  flex: 1;
  min-width: 0;
}

.date-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}
</style>
