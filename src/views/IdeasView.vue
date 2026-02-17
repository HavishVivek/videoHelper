<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'
import { useScriptsStore } from '@/stores/scripts'
import PageContainer from '@/components/layout/PageContainer.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const router = useRouter()
const store = useIdeasStore()
const scriptsStore = useScriptsStore()

const newTopic = ref('')
const showLinkModal = ref(false)
const linkingIdea = ref(null)

onMounted(() => {
  store.loadIdeas()
  scriptsStore.loadScripts()
})

async function handleAddIdea() {
  if (!newTopic.value.trim()) return
  await store.addIdea(newTopic.value.trim())
  newTopic.value = ''
}

function getLinkedScript(idea) {
  return scriptsStore.getScriptByIdeaId(idea.id)
}

function openIdea(idea) {
  const linked = getLinkedScript(idea)
  if (linked) {
    router.push(`/editor/${linked.id}`)
  } else {
    router.push({ name: 'ScriptGenerator', query: { topic: idea.topic, ideaId: idea.id } })
  }
}

function openLinkModal(idea) {
  linkingIdea.value = idea
  showLinkModal.value = true
}

async function handleLinkScript(script) {
  if (!linkingIdea.value) return
  await scriptsStore.linkScriptToIdea(script.id, linkingIdea.value.id)
  showLinkModal.value = false
  linkingIdea.value = null
}

// Scripts not yet linked to any idea
const unlinkableScripts = computed(() => {
  return scriptsStore.sortedScripts.filter(s => !s.ideaId)
})

function updateDate(idea, field, event) {
  store.updateIdea(idea.id, { [field]: event.target.value })
}

function handleDelete(id) {
  if (confirm('Delete this idea?')) {
    store.deleteIdea(id)
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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
            <button class="topic-btn" @click="openIdea(idea)" :title="getLinkedScript(idea) ? 'Open script' : 'Generate script'">
              {{ idea.topic }}
            </button>
            <button @click="handleDelete(idea.id)" class="delete-btn" title="Delete">×</button>
          </div>

          <!-- Script status badge -->
          <div v-if="getLinkedScript(idea)" class="script-badge">
            <span class="badge-dot"></span>
            Script ready &mdash; {{ formatDate(getLinkedScript(idea).updatedAt) }}
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
              :variant="getLinkedScript(idea) ? 'primary' : 'secondary'"
              class="action-btn"
              @click="openIdea(idea)"
            >
              {{ getLinkedScript(idea) ? 'Open Script' : 'Write Script' }}
            </BaseButton>
            <BaseButton
              v-if="!getLinkedScript(idea) && unlinkableScripts.length > 0"
              size="sm"
              variant="ghost"
              class="link-btn"
              title="Link an existing script"
              @click="openLinkModal(idea)"
            >
              🔗 Link
            </BaseButton>
          </div>
        </GlassCard>
      </div>
    </section>

    <!-- Link Script Modal -->
    <BaseModal v-model="showLinkModal" title="Link an existing script" maxWidth="560px">
      <p class="modal-subtitle">Select a script to link to <strong>{{ linkingIdea?.topic }}</strong>:</p>
      <div v-if="unlinkableScripts.length === 0" class="no-scripts">
        No unlinked scripts found. Import or generate a script first.
      </div>
      <ul v-else class="script-list">
        <li
          v-for="script in unlinkableScripts"
          :key="script.id"
          class="script-item"
          @click="handleLinkScript(script)"
        >
          <div class="script-item-topic">{{ script.topic }}</div>
          <div class="script-item-meta">
            {{ script.isManual ? 'Manual' : 'AI Generated' }} &middot; {{ formatDate(script.updatedAt) }}
          </div>
        </li>
      </ul>
      <template #footer>
        <BaseButton variant="secondary" @click="showLinkModal = false">Cancel</BaseButton>
      </template>
    </BaseModal>

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
  margin-bottom: var(--space-sm);
}

.topic-btn {
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  margin-right: var(--space-sm);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.topic-btn:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  flex-shrink: 0;
}

.delete-btn:hover {
  color: var(--color-error);
}

.script-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-success, #4ade80);
  margin-bottom: var(--space-sm);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success, #4ade80);
  flex-shrink: 0;
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
  gap: var(--space-xs);
}

.action-btn {
  flex: 1;
}

.link-btn {
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}

/* Modal styles */
.modal-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

.no-scripts {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-lg);
}

.script-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 320px;
  overflow-y: auto;
}

.script-item {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.script-item:hover {
  background: var(--color-bg-card);
  border-color: var(--color-accent);
}

.script-item-topic {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.script-item-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
