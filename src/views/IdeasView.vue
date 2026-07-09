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
import PrePostChecklistModal from '@/components/script/PrePostChecklistModal.vue'
import { PROJECT_TYPES } from '@/config/projectTypes'
import VueFeather from 'vue-feather'

// Map subfolder names → tab IDs
const folderNameToTab = {
  scripts: 'scripts',
  thumbnails: 'thumbnails',
  filmed: 'filmed',
  footage: 'filmed',
  clips: 'filmed',
  // board is the default for anything unrecognised
}

const router = useRouter()
const store = useIdeasStore()
const scriptsStore = useScriptsStore()
const showTaskSetupModal = ref(false)
const setupIdea = ref(null)        // the freshly created idea
const setupTaskText = ref('')

const vFocus = {
  mounted(el) { el.focus() }
}

// ─── New Project Modal ────────────────────────────────────────────────────────
const showNewProjectModal = ref(false)
const newProjectTopic = ref('')
const newProjectType = ref('youtube')
const newProjectPublic = ref(false)
const creating = ref(false)

const PROJECT_TYPE_LIST = computed(() =>
  Object.entries(PROJECT_TYPES).map(([key, cfg]) => ({ key, ...cfg }))
)

const selectedTypeConfig = computed(() => PROJECT_TYPES[newProjectType.value])

// ─── Link Modal ───────────────────────────────────────────────────────────────
const showLinkModal = ref(false)
const linkingIdea = ref(null)

// ─── Checklist Modal ──────────────────────────────────────────────────────────
const showChecklistModal = ref(false)
const checklistIdea = ref(null)

// ─── Idea Action Modal ────────────────────────────────────────────────────────
const showIdeaModal = ref(false)
const activeIdea = ref(null)
const newSubtaskText = ref('')
const editingSubtaskId = ref(null)
const editingSubtaskText = ref('')

// ─── Folder hover preview ─────────────────────────────────────────────────────
const hoveredFolder = ref(null)

onMounted(() => {
  store.loadIdeas()
  scriptsStore.loadScripts()
})

const setupTasks = computed(() => {
  if (!setupIdea.value) return []
  const live = store.ideas.find(i => i.id === setupIdea.value.id)
  return live?.subtasks || []
})

async function addSetupTask() {
  const text = setupTaskText.value.trim()
  if (!text || !setupIdea.value) return
  await store.addSubtask(setupIdea.value.id, text)
  setupTaskText.value = ''
}

async function updateSetupTaskDate(taskId, field, value) {
  if (!setupIdea.value) return
  await store.updateSubtask(setupIdea.value.id, taskId, { [field]: value || null })
}

async function removeSetupTask(taskId) {
  if (!setupIdea.value) return
  await store.deleteSubtask(setupIdea.value.id, taskId)
}

function finishTaskSetup() {
  const id = setupIdea.value?.id
  showTaskSetupModal.value = false
  setupIdea.value = null
  if (id) router.push(`/ideas/${id}`)   // now go into the project
}

// ─── Create Project ───────────────────────────────────────────────────────────
async function handleCreateProject() {
  if (!newProjectTopic.value.trim()) return
  creating.value = true
  try {
    const newIdea = await store.addIdea(
      newProjectTopic.value.trim(),
      newProjectType.value,
      newProjectPublic.value
    )
    showNewProjectModal.value = false
    newProjectTopic.value = ''
    newProjectType.value = 'youtube'
    newProjectPublic.value = false

    // Open task-setup step instead of jumping into the project
    if (newIdea?.id) {
      setupIdea.value = newIdea
      setupTaskText.value = ''
      showTaskSetupModal.value = true
    }
  } finally {
    creating.value = false
  }
}

function openNewProjectModal() {
  newProjectTopic.value = ''
  newProjectType.value = 'youtube'
  newProjectPublic.value = false
  showNewProjectModal.value = true
}

// ─── Script helpers ───────────────────────────────────────────────────────────
function getLinkedScript(idea) {
  return scriptsStore.getScriptByIdeaId(idea.id)
}

function isVideoType(idea) {
  return (idea.type || 'youtube') === 'youtube'
}

// ─── Idea Action Modal ────────────────────────────────────────────────────────
function openIdeaModal(idea) {
  activeIdea.value = idea
  newSubtaskText.value = ''
  showIdeaModal.value = true
}

function closeIdeaModal() {
  showIdeaModal.value = false
  activeIdea.value = null
  newSubtaskText.value = ''
  editingSubtaskId.value = null
  editingSubtaskText.value = ''
}

function goScriptIdea() {
  const idea = activeIdea.value
  closeIdeaModal()
  router.push({ name: 'ScriptGenerator', query: { topic: idea.topic, ideaId: idea.id } })
}

function goOpenScript() {
  const linked = getLinkedScript(activeIdea.value)
  closeIdeaModal()
  router.push(`/editor/${linked.id}`)
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────
const activeIdeaSubtasks = computed(() => {
  if (!activeIdea.value) return []
  const live = store.ideas.find(i => i.id === activeIdea.value.id)
  return live?.subtasks || []
})

async function handleAddSubtask() {
  if (!newSubtaskText.value.trim() || !activeIdea.value) return
  await store.addSubtask(activeIdea.value.id, newSubtaskText.value.trim())
  newSubtaskText.value = ''
}

async function handleToggleSubtask(subtaskId) {
  if (!activeIdea.value) return
  await store.toggleSubtask(activeIdea.value.id, subtaskId)
}

async function handleDeleteSubtask(subtaskId) {
  if (!activeIdea.value) return
  await store.deleteSubtask(activeIdea.value.id, subtaskId)
}

async function handleUpdateSubtaskDate(subtaskId, field, value) {
  if (!activeIdea.value) return
  await store.updateSubtask(activeIdea.value.id, subtaskId, { [field]: value || null })
}

function startEditSubtask(subtask) {
  editingSubtaskId.value = subtask.id
  editingSubtaskText.value = subtask.text
}

async function commitEditSubtask(subtaskId) {
  if (!activeIdea.value) return
  const text = editingSubtaskText.value.trim()
  if (text) {
    await store.updateSubtask(activeIdea.value.id, subtaskId, { text })
  }
  editingSubtaskId.value = null
  editingSubtaskText.value = ''
}

function cancelEditSubtask() {
  editingSubtaskId.value = null
  editingSubtaskText.value = ''
}

function handleUpdateNotes(value) {
  if (!activeIdea.value) return
  store.updateIdea(activeIdea.value.id, { notes: value })
}

// ─── Checklist / Posted ───────────────────────────────────────────────────────
function openChecklistModal(idea) {
  checklistIdea.value = idea
  showChecklistModal.value = true
}

async function handleIdeaPosted() {
  if (!checklistIdea.value) return
  const idea = checklistIdea.value
  await store.updateIdea(idea.id, { status: 'posted', postedAt: new Date().toISOString() })
  const linked = getLinkedScript(idea)
  if (linked) {
    await scriptsStore.updateScript(linked.id, { posted: true, postedAt: new Date().toISOString() })
  }
  checklistIdea.value = null
  window.__toast?.('Video marked as posted!', 'success')
}

// ─── Link Script ──────────────────────────────────────────────────────────────
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

const unlinkableScripts = computed(() =>
  scriptsStore.sortedScripts.filter(s => !s.ideaId)
)

// ─── Privacy toggle ───────────────────────────────────────────────────────────
async function togglePrivacy(idea, event) {
  event.stopPropagation()
  await store.updateIdea(idea.id, { isPublic: !idea.isPublic })
}

// ─── Folder helpers ───────────────────────────────────────────────────────────
function getFolders(idea) {
  const config = PROJECT_TYPES[idea.type] || PROJECT_TYPES['youtube']
  return config.subfolders.map(name => ({
    name,
    items: idea.subfolders?.[name] || [],
  }))
}

function folderCompletionPct(folder) {
  if (!folder.items.length) return 0
  const done = folder.items.filter(i => i.completed).length
  return Math.round((done / folder.items.length) * 100)
}

function folderIcon(name) {
  const icons = {
    scripts: 'file-text', thumbnails: 'image', clips: 'film', footage: 'video',
    audio: 'mic', exports: 'package', assets: 'folder', docs: 'file-text',
    schematics: 'cpu', code: 'code', research: 'search', mockups: 'pen-tool',
    references: 'book', notes: 'edit-3', renders: 'aperture', uploads: 'upload-cloud',
  }
  return icons[name.toLowerCase()] || 'folder'
}

// ─── Dates ────────────────────────────────────────────────────────────────────
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

function typeLabel(type) {
  return PROJECT_TYPES[type]?.label || type
}

function typeIcon(type) {
  const icons = { youtube: 'youtube', electronics: 'zap', coding: 'code' }
  return icons[type] || 'folder'
}
</script>

<template>
  <PageContainer title="Ideas Board" subtitle="Brainstorm and schedule your next viral videos">

    <!-- Header row: New Project button -->
    <section class="board-header">
      <BaseButton size="lg" icon="plus" @click="openNewProjectModal">
        New Project
      </BaseButton>
    </section>

    <!-- Ideas List -->
    <section class="ideas-list">
      <div v-if="store.loading" class="loading">Loading ideas...</div>

      <div v-else-if="store.ideas.length === 0" class="empty-state">
        <vue-feather type="zap" class="empty-icon" />
        <h3>No projects yet</h3>
        <p>Hit <strong>New Project</strong> to get started.</p>
      </div>

      <div v-else class="grid">
        <GlassCard v-for="idea in store.ideas" :key="idea.id" class="idea-card" padding="md">
          <!-- Card header -->
          <div class="card-header">
            <div class="card-meta">
              <span class="type-chip">
                <vue-feather :type="typeIcon(idea.type)" size="13" /> {{ typeLabel(idea.type) }}
              </span>
              <button class="privacy-toggle" :class="{ public: idea.isPublic }"
                :title="idea.isPublic ? 'Public — click to make private' : 'Private — click to make public'"
                @click="togglePrivacy(idea, $event)">
                <vue-feather :type="idea.isPublic ? 'globe' : 'lock'" size="12" />
                {{ idea.isPublic ? 'Public' : 'Private' }}
              </button>
            </div>
            <button @click.stop="handleDelete(idea.id)" class="delete-btn" title="Delete">
              <vue-feather type="x" size="16" />
            </button>
          </div>

          <button class="topic-btn" @click="router.push(`/ideas/${idea.id}`)">
            {{ idea.topic }}
          </button>

          <!-- Script status badge -->
          <div v-if="getLinkedScript(idea)" class="script-badge">
            <span class="badge-dot"></span>
            Script ready &mdash; {{ formatDate(getLinkedScript(idea).updatedAt) }}
          </div>

          <!-- Subtask progress -->
          <div v-if="(idea.subtasks || []).length" class="subtask-preview">
            <span class="subtask-count">
              {{(idea.subtasks || []).filter(s => s.completed).length}}/{{ (idea.subtasks || []).length }} tasks
            </span>
            <div class="subtask-bar">
              <div class="subtask-bar-fill"
                :style="{ width: ((idea.subtasks || []).filter(s => s.completed).length / (idea.subtasks || []).length * 100) + '%' }">
              </div>
            </div>
          </div>

          <!-- ── Folder Grid ── -->
          <div v-if="getFolders(idea).length" class="folder-grid">
            <div v-for="folder in getFolders(idea)" :key="folder.name" class="folder-cell"
              @mouseenter="hoveredFolder = { ideaId: idea.id, folderName: folder.name }"
              @mouseleave="hoveredFolder = null"
              @click.stop="router.push({ path: `/ideas/${idea.id}`, query: { tab: folder.name } })">
              <span class="folder-icon">
                <vue-feather :type="folderIcon(folder.name)" size="20" />
              </span>
              <span class="folder-name">{{ folder.name }}</span>
              <div v-if="hoveredFolder?.ideaId === idea.id && hoveredFolder?.folderName === folder.name"
                class="folder-tooltip">
                <div class="tooltip-title">{{ folder.name }}</div>
                <div class="tooltip-count">{{ folder.items.length }} item{{ folder.items.length !== 1 ? 's' : '' }}
                </div>
                <template v-if="folder.items.length">
                  <div class="tooltip-bar-wrap">
                    <div class="tooltip-bar">
                      <div class="tooltip-bar-fill" :style="{ width: folderCompletionPct(folder) + '%' }"></div>
                    </div>
                    <span class="tooltip-pct">{{ folderCompletionPct(folder) }}%</span>
                  </div>
                </template>
                <div v-else class="tooltip-empty">Empty</div>
              </div>
            </div>
          </div>

          <!-- Schedule section -->
          <!-- Schedule section — video/YouTube projects only -->
          <div v-if="isVideoType(idea)" class="schedule-section">
            <div class="date-range-field">
              <span class="date-range-label"><vue-feather type="edit-3" size="13" /> Scripting</span>
              <div class="date-range-inputs">
                <input type="date" :value="idea.scheduledScriptDate"
                  @input="e => updateDate(idea, 'scheduledScriptDate', e)" class="date-input" />
                <span class="range-sep">→</span>
                <input type="date" :value="idea.scheduledScriptEndDate" :min="idea.scheduledScriptDate"
                  @input="e => updateDate(idea, 'scheduledScriptEndDate', e)" class="date-input"
                  :disabled="!idea.scheduledScriptDate" />
              </div>
            </div>
            <div class="date-range-field">
              <span class="date-range-label"><vue-feather type="video" size="13" /> Filming</span>
              <div class="date-range-inputs">
                <input type="date" :value="idea.scheduledFilmDate"
                  @input="e => updateDate(idea, 'scheduledFilmDate', e)" class="date-input" />
                <span class="range-sep">→</span>
                <input type="date" :value="idea.scheduledFilmEndDate" :min="idea.scheduledFilmDate"
                  @input="e => updateDate(idea, 'scheduledFilmEndDate', e)" class="date-input"
                  :disabled="!idea.scheduledFilmDate" />
              </div>
            </div>
            <div class="date-range-field">
              <span class="date-range-label"><vue-feather type="tv" size="13" /> Post Date</span>
              <div class="date-range-inputs">
                <input type="date" :value="idea.scheduledPostDate"
                  @input="e => updateDate(idea, 'scheduledPostDate', e)" class="date-input post-date-input" />
              </div>
            </div>
          </div>

          <!-- Card actions -->
          <div class="card-actions">
            <BaseButton size="sm" variant="secondary" class="action-btn folder-btn"
              @click="router.push(`/ideas/${idea.id}`)">
              <vue-feather type="folder" size="14" /> Open Folder
            </BaseButton>

            <!-- Script / Write — video projects only -->
            <BaseButton v-if="isVideoType(idea)" size="sm" :variant="getLinkedScript(idea) ? 'primary' : 'secondary'"
              class="action-btn" @click="openIdeaModal(idea)">
              <vue-feather :type="getLinkedScript(idea) ? 'file-text' : 'edit-2'" size="14" />
              {{ getLinkedScript(idea) ? 'Script' : 'Write' }}
            </BaseButton>

            <BaseButton v-if="isVideoType(idea) && !getLinkedScript(idea) && unlinkableScripts.length > 0" size="sm"
              variant="ghost" class="link-btn" @click.stop="openLinkModal(idea)">
              <vue-feather type="link" size="14" />
            </BaseButton>
          </div>
        </GlassCard>
      </div>
    </section>

    <!-- NEW PROJECT MODAL -->
    <BaseModal v-model="showNewProjectModal" title="New Project" maxWidth="600px">
      <div class="new-project-body">
        <div class="field-group">
          <label class="field-label">Project Topic</label>
          <BaseInput v-model="newProjectTopic" placeholder="e.g. 'Day in the life of a coder'..."
            @keydown.enter="handleCreateProject" autofocus />
        </div>

        <div class="field-group">
          <label class="field-label">Project Type</label>
          <div class="type-selector">
            <button v-for="pt in PROJECT_TYPE_LIST" :key="pt.key" class="type-option"
              :class="{ active: newProjectType === pt.key }" @click="newProjectType = pt.key">
              <span class="type-opt-label">{{ pt.label }}</span>
              <span class="type-opt-desc">{{ pt.description }}</span>
              <div class="type-opt-folders">
                <span v-for="sf in pt.subfolders" :key="sf" class="preview-folder-chip">
                  <vue-feather :type="folderIcon(sf)" size="12" /> {{ sf }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="selectedTypeConfig" class="preview-block">
          <p class="preview-label">Subfolders that will be created</p>
          <div class="preview-folders">
            <span v-for="sf in selectedTypeConfig.subfolders" :key="sf" class="preview-folder-chip">
              {{ folderIcon(sf) }} {{ sf }}
            </span>
          </div>
        </div>

        <div v-if="selectedTypeConfig?.defaultTasks?.length" class="preview-block">
          <p class="preview-label">Default tasks ({{ selectedTypeConfig.defaultTasks.length }})</p>
          <ul class="preview-tasks">
            <li v-for="task in selectedTypeConfig.defaultTasks" :key="task" class="preview-task">
              <span class="task-dot"></span>{{ task }}
            </li>
          </ul>
        </div>

        <div class="field-group privacy-field">
          <label class="field-label">Visibility</label>
          <div class="privacy-row">
            <button class="privacy-opt" :class="{ active: !newProjectPublic }" @click="newProjectPublic = false">
              <vue-feather type="lock" size="14" /> Private
            </button>
            <button class="privacy-opt" :class="{ active: newProjectPublic }" @click="newProjectPublic = true">
              <vue-feather type="globe" size="14" /> Public
            </button>
          </div>
          <p class="privacy-hint">
            {{ newProjectPublic ? 'This project will be visible to others.' : 'Only you can see this project.' }}
          </p>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="showNewProjectModal = false">Cancel</BaseButton>
        <BaseButton :disabled="!newProjectTopic.trim() || creating" @click="handleCreateProject">
          {{ creating ? 'Creating…' : 'Create Project' }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- TASK SETUP MODAL (after creating a project) -->
    <BaseModal v-model="showTaskSetupModal" title="Set up your tasks" maxWidth="560px">
      <p class="modal-subtitle">
        What needs to get done for <strong>{{ setupIdea?.topic }}</strong>? Add each task and schedule it.
      </p>

      <form class="add-subtask-form" @submit.prevent="addSetupTask">
        <input v-model="setupTaskText" class="subtask-input"
          placeholder="e.g. Write script, Order parts, Record intro…" maxlength="200" />
        <button type="submit" class="subtask-add-btn" :disabled="!setupTaskText.trim()">
          <vue-feather type="plus" size="16" />
        </button>
      </form>

      <ul v-if="setupTasks.length" class="subtask-list">
        <li v-for="task in setupTasks" :key="task.id" class="subtask-item">
          <div class="subtask-row">
            <span class="subtask-text">{{ task.text }}</span>
            <button class="subtask-delete" @click="removeSetupTask(task.id)" title="Remove">
              <vue-feather type="x" size="14" />
            </button>
          </div>
          <div class="subtask-dates">
            <input type="date" :value="task.startDate"
              @input="e => updateSetupTaskDate(task.id, 'startDate', e.target.value)"
              class="subtask-date-input" />
            <span class="subtask-date-sep">→</span>
            <input type="date" :value="task.endDate" :min="task.startDate"
              @input="e => updateSetupTaskDate(task.id, 'endDate', e.target.value)"
              class="subtask-date-input" :disabled="!task.startDate" />
          </div>
        </li>
      </ul>
      <p v-else class="subtask-empty">No tasks yet. Add the first thing you need to do.</p>

      <template #footer>
        <BaseButton variant="secondary" @click="finishTaskSetup">Skip for now</BaseButton>
        <BaseButton @click="finishTaskSetup">Done — Open Project</BaseButton>
      </template>
    </BaseModal>

    <!-- IDEA ACTION MODAL -->
    <BaseModal v-model="showIdeaModal" :title="activeIdea?.topic" maxWidth="560px">
      <div v-if="activeIdea" class="idea-modal-body">
        <!-- Script section — video/YouTube projects only -->
        <template v-if="isVideoType(activeIdea)">
          <div v-if="!getLinkedScript(activeIdea)" class="modal-action-block">
            <p class="modal-block-label">Script</p>
            <BaseButton block @click="goScriptIdea">
              <vue-feather type="edit-2" size="14" /> Write Script for this Idea
            </BaseButton>
          </div>
          <div v-else class="modal-action-block">
            <p class="modal-block-label">Script</p>
            <button class="open-script-link" @click="goOpenScript">
              <vue-feather type="check-circle" size="14" /> Script ready — Open in Editor →
            </button>
            <template v-if="getLinkedScript(activeIdea)?.posted">
              <span class="posted-badge">Posted {{ getLinkedScript(activeIdea).postedAt ? new
                Date(getLinkedScript(activeIdea).postedAt).toLocaleDateString() : '' }}</span>
            </template>
            <template v-else>
              <BaseButton size="sm" variant="success" class="posted-btn" @click="openChecklistModal(activeIdea)">Video
                is
                Posted</BaseButton>
            </template>
          </div>

          <div class="modal-divider"></div>
        </template>

        <div class="notes-section">
          <p class="modal-block-label">Notes</p>
          <textarea class="notes-textarea" :value="activeIdea.notes || ''"
            @input="e => handleUpdateNotes(e.target.value)" placeholder="Add notes, research links, ideas..."
            rows="4"></textarea>
        </div>

        <div class="modal-divider"></div>

        <div class="subtasks-section">
          <p class="modal-block-label">Subtasks</p>
          <form class="add-subtask-form" @submit.prevent="handleAddSubtask">
            <input v-model="newSubtaskText" class="subtask-input" placeholder="Add a subtask..." maxlength="200" />
            <button type="submit" class="subtask-add-btn" :disabled="!newSubtaskText.trim()">
              <vue-feather type="plus" size="16" />
            </button>
          </form>
          <ul v-if="activeIdeaSubtasks.length" class="subtask-list">
            <li v-for="subtask in activeIdeaSubtasks" :key="subtask.id" class="subtask-item"
              :class="{ completed: subtask.completed }">
              <div class="subtask-row">
                <button class="subtask-check" @click="handleToggleSubtask(subtask.id)">
                  <vue-feather v-if="subtask.completed" type="check" size="16" />
                </button>
                <template v-if="editingSubtaskId === subtask.id">
                  <input v-model="editingSubtaskText" class="subtask-edit-input"
                    @keydown.enter.prevent="commitEditSubtask(subtask.id)" @keydown.escape="cancelEditSubtask"
                    @blur="commitEditSubtask(subtask.id)" v-focus />
                </template>
                <span v-else class="subtask-text" @click="startEditSubtask(subtask)">{{ subtask.text }}</span>
                <button class="subtask-delete" @click="handleDeleteSubtask(subtask.id)" title="Remove">
                  <vue-feather type="x" size="14" />
                </button>
              </div>
              <div class="subtask-dates">
                <input type="date" :value="subtask.startDate"
                  @input="e => handleUpdateSubtaskDate(subtask.id, 'startDate', e.target.value)"
                  class="subtask-date-input" />
                <span class="subtask-date-sep">→</span>
                <input type="date" :value="subtask.endDate" :min="subtask.startDate"
                  @input="e => handleUpdateSubtaskDate(subtask.id, 'endDate', e.target.value)"
                  class="subtask-date-input" :disabled="!subtask.startDate" />
              </div>
            </li>
          </ul>
          <p v-else class="subtask-empty">No subtasks yet. Add one above.</p>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="closeIdeaModal">Close</BaseButton>
      </template>
    </BaseModal>

    <!-- LINK SCRIPT MODAL -->
    <BaseModal v-model="showLinkModal" title="Link an existing script" maxWidth="560px">
      <p class="modal-subtitle">Select a script to link to <strong>{{ linkingIdea?.topic }}</strong>:</p>
      <div v-if="unlinkableScripts.length === 0" class="no-scripts">No unlinked scripts found.</div>
      <ul v-else class="script-list">
        <li v-for="script in unlinkableScripts" :key="script.id" class="script-item" @click="handleLinkScript(script)">
          <div class="script-item-topic">{{ script.topic }}</div>
          <div class="script-item-meta">{{ script.isManual ? 'Manual' : 'AI Generated' }} &middot; {{
            formatDate(script.updatedAt) }}</div>
        </li>
      </ul>
      <template #footer>
        <BaseButton variant="secondary" @click="showLinkModal = false">Cancel</BaseButton>
      </template>
    </BaseModal>

    <PrePostChecklistModal v-model="showChecklistModal" :ideaId="checklistIdea?.id" @confirm="handleIdeaPosted" />

  </PageContainer>
</template>

<style scoped>
.board-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-xl);
}

.ideas-list {
  margin-top: var(--space-sm);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.idea-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  flex: 1;
  margin-right: var(--space-sm);
}

.type-chip {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--color-border);
  padding: 2px 8px;
  border-radius: 20px;
}

.privacy-toggle {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.privacy-toggle.public {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.4);
  background: rgba(96, 165, 250, 0.08);
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

.topic-btn {
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  cursor: pointer;
  transition: color var(--transition-fast);
  width: 100%;
}

.topic-btn:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.script-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-success, #4ade80);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success, #4ade80);
  flex-shrink: 0;
}

.subtask-preview {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.subtask-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.subtask-bar {
  flex: 1;
  height: 4px;
  background: var(--color-bg-input);
  border-radius: 2px;
  overflow: hidden;
}

.subtask-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 6px;
  padding: var(--space-sm);
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.folder-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  text-align: center;
}

.folder-cell:hover {
  background: rgba(255, 255, 255, 0.07);
}

.vue-feather {
  display: inline-flex;
  align-items: center;
}

.folder-name {
  font-size: 10px;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.folder-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-card, #1e1e2e);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  min-width: 120px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.tooltip-title {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-text-primary);
  text-transform: capitalize;
  margin-bottom: 4px;
}

.tooltip-count {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.tooltip-bar-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tooltip-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.tooltip-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
}

.tooltip-pct {
  font-size: 10px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.tooltip-empty {
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}

.schedule-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  background: rgba(0, 0, 0, 0.2);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  margin-top: auto;
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

.post-date-input {
  max-width: 140px;
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



.loading {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
}

/* New project modal */
.new-project-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.field-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.type-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-sm);
}

.type-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  background: none;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  text-align: left;
}

.type-option:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.2);
}

.type-option.active {
  border-color: var(--color-accent);
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.1);
}

.empty-icon {
  font-size: 48px;
  /* keep, harmless */
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-md);
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.folder-icon {
  font-size: 20px;
  line-height: 1;
}

.folder-icon svg {
  width: 20px;
  height: 20px;
}

.type-opt-icon {
  font-size: 20px;
  margin-bottom: 2px;
}

.type-opt-icon svg {
  width: 20px;
  height: 20px;
}

.type-opt-folders {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

/* inline icons that sit next to text — align them */
.type-chip svg,
.privacy-toggle svg,
.date-range-label svg,
.preview-folder-chip svg,
.privacy-opt svg {
  vertical-align: middle;
}


.type-opt-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-primary);
}

.type-opt-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.3;
}

.preview-block {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.preview-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}

.preview-folders {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.preview-folder-chip {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--color-border);
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: capitalize;
}

.preview-tasks {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 140px;
  overflow-y: auto;
}

.preview-task {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.task-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}

.privacy-row {
  display: flex;
  gap: var(--space-sm);
}

.privacy-opt {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  background: none;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.privacy-opt:hover {
  background: rgba(255, 255, 255, 0.04);
}

.privacy-opt.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb, 99, 102, 241), 0.08);
}

.privacy-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* Idea modal */
.idea-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.modal-block-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
  font-weight: 600;
}

.modal-action-block {
  display: flex;
  flex-direction: column;
}

.open-script-link {
  background: none;
  border: 1px solid var(--color-success, #4ade80);
  color: var(--color-success, #4ade80);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
}

.open-script-link:hover {
  background: rgba(74, 222, 128, 0.08);
}

.posted-btn {
  margin-top: var(--space-sm);
  width: 100%;
}

.posted-badge {
  display: inline-block;
  margin-top: var(--space-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-success, #22c55e);
  background: rgba(34, 197, 94, 0.12);
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
}

.modal-divider {
  height: 1px;
  background: var(--color-border);
}

.notes-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.notes-textarea {
  width: 100%;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.notes-textarea:focus {
  border-color: var(--color-accent);
}

.notes-textarea::placeholder {
  color: var(--color-text-muted);
}

/* Subtasks */
.subtasks-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.add-subtask-form {
  display: flex;
  gap: var(--space-xs);
}

.subtask-input {
  flex: 1;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  outline: none;
  transition: border-color var(--transition-fast);
}

.subtask-input:focus {
  border-color: var(--color-accent);
}

.subtask-add-btn {
  background: var(--color-accent);
  color: #000;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-lg);
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}

.subtask-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.subtask-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}

.subtask-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.subtask-item:hover {
  background: var(--color-bg-card);
}

.subtask-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.subtask-dates {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 28px;
}

.subtask-date-input {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
  flex: 1;
  min-width: 0;
}

.subtask-date-input:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.subtask-date-sep {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.subtask-check {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
  color: var(--color-accent);
}

.subtask-item.completed .subtask-check {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #000;
}

.subtask-text {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: text;
  transition: all var(--transition-fast);
}

.subtask-item.completed .subtask-text {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.subtask-delete {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast);
}

.subtask-item:hover .subtask-delete {
  opacity: 1;
}

.subtask-delete:hover {
  color: var(--color-error);
}

.subtask-empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-md) 0;
}

.subtask-edit-input {
  flex: 1;
  background: var(--color-bg-input);
  border: 1px solid var(--color-accent);
  color: var(--color-text-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: inherit;
  font-size: var(--font-size-sm);
  outline: none;
}

/* Link modal */
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