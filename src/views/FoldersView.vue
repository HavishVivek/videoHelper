<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'
import { useScriptsStore } from '@/stores/scripts'
import PageContainer from '@/components/layout/PageContainer.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FolderSearch from './Foldersearch.vue'
import FolderProgressBadge from './Folderprogressbadge.vue'

import {
  PhFolder, PhFolderOpen, PhFileTxt, PhImage, PhVideo,
  PhLink, PhNote, PhArrowRight, PhPlus,
  PhRocket, PhScissors, PhMagnifyingGlass, PhCheck,
  PhVideoCamera, PhCircuitry, PhListChecks, PhWrench,
  PhPlugs, PhCurrencyDollar, PhClipboardText, PhFlask,
} from '@phosphor-icons/vue'

const router = useRouter()
const ideasStore = useIdeasStore()
const scriptsStore = useScriptsStore()

const showNewFolderModal = ref(false)
const newFolderTopic = ref('')
const newFolderType = ref('video')
const creating = ref(false)

// UPGRADE 2 — bars/rings start empty, then animate to their value after
// mount so the existing CSS transitions actually fire on first paint.
const animateIn = ref(false)

const PROJECT_TYPES = [
  { id: 'video', label: 'Video', icon: PhVideoCamera },
  { id: 'electronics', label: 'Electronics', icon: PhCircuitry },
]

const openFolderId = ref(null)
const contentCache = ref({})
const closeTimer = ref(null)
const openTimer = ref(null)

// ── Progress stage definitions per project type ────────────────────────────
const VIDEO_STAGES = [
  { id: 'research', icon: PhMagnifyingGlass, isDone: (c) => (c.idea.canvasCards?.length || 0) > 0 || (c.idea.subtasks?.length || 0) > 0 },
  { id: 'script', icon: PhFileTxt, isDone: (c) => c.scripts.length > 0 },
  { id: 'thumbnail', icon: PhImage, isDone: (c) => c.thumbnails.some(t => t.imageName || t.title || t.concept) },
  { id: 'filming', icon: PhVideo, isDone: (c) => c.sections.some(s => s.status === 'filmed' || s.status === 'edited' || s.videoName) },
  { id: 'editing', icon: PhScissors, isDone: (c) => c.sections.some(s => s.status === 'edited') },
  { id: 'publish', icon: PhRocket, isDone: (c) => c.scripts.some(s => s.posted) || c.idea.status === 'published' },
]

const ELECTRONICS_STAGES = [
  { id: 'design', icon: PhCircuitry, isDone: (c) => (c.idea.canvasCards || []).some(x => x.type === 'schematic' || x.type === 'pinout') },
  { id: 'bom', icon: PhListChecks, isDone: (c) => (c.idea.bom?.length || 0) > 0 },
  { id: 'ordered', icon: PhCurrencyDollar, isDone: (c) => (c.idea.bom || []).length > 0 && (c.idea.bom || []).every(p => p.status === 'ordered' || p.status === 'have') },
  { id: 'wiring', icon: PhPlugs, isDone: (c) => (c.idea.pinout?.length || 0) > 0 },
  { id: 'assembly', icon: PhWrench, isDone: (c) => (c.idea.buildLog || []).some(e => /assembl|solder|wired|built/i.test(e.text || '')) },
  { id: 'testing', icon: PhFlask, isDone: (c) => (c.idea.buildLog || []).some(e => e.result === 'pass') || c.idea.status === 'working' },
]

function getStages(idea) {
  return idea.projectType === 'electronics' ? ELECTRONICS_STAGES : VIDEO_STAGES
}

function computeProgress(idea, scripts, thumbnails, filmedSections) {
  const ctx = { idea, scripts, thumbnails, sections: filmedSections }
  const stages = getStages(idea).map(s => ({ ...s, done: s.isDone(ctx) }))

  const tasks = idea.subtasks || []
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.completed).length
  const completionPct = totalTasks
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0

  return { stages, completionPct, doneTasks, totalTasks }
}

// ── Preview items (the fanned cards), per project type ──────────────────────
function getVideoPreview(idea, scripts, thumbnails, filmedSections) {
  const items = []
  scripts.slice(0, 2).forEach(s => items.push({ type: 'script', icon: PhFileTxt, name: s.topic, meta: s.isManual ? 'Manual' : 'AI', id: s.id }))
  thumbnails.slice(0, 1).forEach(t => items.push({ type: 'thumbnail', icon: PhImage, name: t.title || 'Untitled thumbnail', meta: 'Thumbnail', id: t.id }))
  filmedSections.slice(0, 2).forEach(s => items.push({ type: 'section', icon: PhVideo, name: s.name, meta: s.status || 'Not filmed', id: s.id }));
  (idea.canvasCards || []).filter(c => c.type === 'link').slice(0, 1).forEach(c => items.push({ type: 'link', icon: PhLink, name: c.title || c.domain || 'Link', meta: 'Link', id: c.id }));
  (idea.canvasCards || []).filter(c => c.type === 'note').slice(0, 1).forEach(c => items.push({ type: 'note', icon: PhNote, name: c.text?.slice(0, 40) || 'Note', meta: 'Note', id: c.id }))
  return items.slice(0, 5)
}

function getElectronicsPreview(idea) {
  const items = []
  const bom = idea.bom || []
  const pinout = idea.pinout || []
  const buildLog = idea.buildLog || []

  bom.slice(0, 2).forEach(p => items.push({
    type: 'part', icon: PhListChecks,
    name: p.name || 'Part',
    meta: `${p.qty || 1}× · ${p.status || 'needed'}`,
    id: p.id,
  }))
  pinout.slice(0, 1).forEach(p => items.push({
    type: 'pinout', icon: PhPlugs,
    name: `${p.from || '?'} → ${p.to || '?'}`,
    meta: p.note || 'Connection',
    id: p.id,
  }));
  (idea.canvasCards || []).filter(c => c.type === 'datasheet' || c.type === 'schematic' || c.type === 'link').slice(0, 1).forEach(c => items.push({
    type: 'link', icon: PhLink,
    name: c.title || c.domain || c.name || 'Reference',
    meta: (c.type || 'link').charAt(0).toUpperCase() + (c.type || 'link').slice(1),
    id: c.id,
  }))
  buildLog.slice(0, 2).forEach(e => items.push({
    type: 'log', icon: PhClipboardText,
    name: (e.text || 'Log entry').slice(0, 40),
    meta: e.result ? e.result.toUpperCase() : 'Log',
    id: e.id,
  }))
  return items.slice(0, 5)
}

function getPreviewItems(idea, scripts, thumbnails, filmedSections) {
  return idea.projectType === 'electronics'
    ? getElectronicsPreview(idea)
    : getVideoPreview(idea, scripts, thumbnails, filmedSections)
}

onMounted(async () => {
  await ideasStore.loadIdeas()
  await scriptsStore.loadScripts()
  // let the cards paint at 0, then trigger the fill/ring transitions
  await nextTick()
  requestAnimationFrame(() => requestAnimationFrame(() => { animateIn.value = true }))
})

const folders = computed(() =>
  ideasStore.ideas.map(rawIdea => {
    const idea = { ...rawIdea, projectType: rawIdea.type === 'electronics' ? 'electronics' : 'video' }
    const scripts = scriptsStore.getScriptsByIdeaId
      ? scriptsStore.getScriptsByIdeaId(idea.id)
      : (scriptsStore.scripts || []).filter(s => s.ideaId === idea.id)
    const thumbnails = idea.thumbnails || []
    const filmedSections = idea.filmedSections || []
    const progress = computeProgress(idea, scripts, thumbnails, filmedSections)
    return { idea, scripts, thumbnails, filmedSections, progress }
  })
)

function getItems(folder) {
  if (contentCache.value[folder.idea.id]) return contentCache.value[folder.idea.id]
  const items = getPreviewItems(folder.idea, folder.scripts, folder.thumbnails, folder.filmedSections)
  contentCache.value[folder.idea.id] = items
  return items
}

function onFolderEnter(ideaId) {
  clearTimeout(closeTimer.value)
  openTimer.value = setTimeout(() => { openFolderId.value = ideaId }, 60)
}

function onFolderLeave() {
  clearTimeout(openTimer.value)
  closeTimer.value = setTimeout(() => { openFolderId.value = null }, 120)
}

function openFolder(ideaId) {
  clearTimeout(closeTimer.value)
  clearTimeout(openTimer.value)
  router.push({ name: 'IdeaFolder', params: { id: ideaId } })
}

function openItem(folder, item) {
  if (item.type === 'script') { router.push(`/editor/${item.id}`); return }
  openFolder(folder.idea.id)
}

async function createFolder() {
  if (!newFolderTopic.value.trim()) return
  creating.value = true
  try {
    const typeForStore = newFolderType.value === 'video' ? 'youtube' : newFolderType.value
    const newIdea = await ideasStore.addIdea(newFolderTopic.value.trim(), typeForStore, false)
    showNewFolderModal.value = false
    newFolderTopic.value = ''
    newFolderType.value = 'video'
    if (newIdea?.id) router.push(`/ideas/${newIdea.id}`)
  } finally {
    creating.value = false
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function folderTypeMeta(idea) {
  return PROJECT_TYPES.find(t => t.id === (idea.projectType || 'video')) || PROJECT_TYPES[0]
}
</script>

<template>
  <PageContainer title="Folders" subtitle="All your project folders">

    <FolderSearch :folders="folders" @open-folder="openFolder" />

    <div class="folders-header">
      <p class="folders-count">{{ folders.length }} folder{{ folders.length !== 1 ? 's' : '' }}</p>
      <BaseButton @click="showNewFolderModal = true">
        <PhPlus :size="14" weight="bold" />
        New Folder
      </BaseButton>
    </div>

    <div v-if="!ideasStore.loading && !folders.length" class="empty-state">
      <PhFolderOpen :size="48" weight="thin" style="color: var(--color-text-muted)" />
      <p>No folders yet.</p>
      <p class="empty-sub">Create a folder for each project.</p>
      <BaseButton @click="showNewFolderModal = true">Create First Folder</BaseButton>
    </div>

    <div v-else-if="ideasStore.loading" class="loading-state">
      <p class="loading-text">Loading folders…</p>
    </div>

    <div v-else class="folders-grid">
      <!-- UPGRADE 2 — rise-in via .fp-rise + index-based delay -->
      <div v-for="(folder, i) in folders" :key="folder.idea.id" class="fp fp-rise"
        :style="{ animationDelay: (i * 100) + 'ms' }"
        :class="{ 'fp--open': openFolderId === folder.idea.id, 'fp--electronics': folder.idea.projectType === 'electronics' }"
        @mouseenter="onFolderEnter(folder.idea.id)" @mouseleave="onFolderLeave" @click="openFolder(folder.idea.id)"
        role="button" tabindex="0" :aria-label="`Open folder: ${folder.idea.topic}`"
        @keydown.enter="openFolder(folder.idea.id)" @keydown.escape="openFolderId = null">
        <!-- Papers fan out above the folder -->
        <div class="fp__papers" @click.stop>
          <template v-if="getItems(folder).length">
            <button v-for="(item, idx) in getItems(folder)" :key="item.id" class="fp__paper"
              :style="{ '--i': idx, '--n': getItems(folder).length }" @click.stop="openItem(folder, item)"
              :aria-label="`Open ${item.name}`">
              <div class="fp__paper-icon-wrap" :data-type="item.type">
                <component :is="item.icon" :size="14" weight="regular" />
              </div>
              <div class="fp__paper-content">
                <span class="fp__paper-name">{{ item.name }}</span>
                <span class="fp__paper-meta">{{ item.type.charAt(0).toUpperCase() + item.type.slice(1) }} · {{ item.meta
                  }}</span>
              </div>
            </button>
          </template>
          <div v-else class="fp__paper fp__paper--empty" style="--i:0; --n:1">
            <PhPlus :size="14" weight="regular" />
            <span class="fp__paper-name">Empty — click to add items</span>
          </div>
        </div>

        <!-- UPGRADE 2 — progress badge: ring fills + percentage counts up -->
        <FolderProgressBadge :pct="folder.progress.completionPct" :doneTasks="folder.progress.doneTasks"
          :totalTasks="folder.progress.totalTasks" :animate="animateIn" :delay="i * 100" />

        <!-- The folder itself: back panel, tab, tilting front flap -->
        <div class="fp__folder">
          <div class="fp__back" />
          <div class="fp__tab" />
          <div class="fp__front">
            <div class="fp__front-row">
              <PhFolder class="fp__front-icon fp--closed-icon" :size="22" weight="fill" />
              <PhFolderOpen class="fp__front-icon fp--open-icon" :size="22" weight="fill" />
              <span class="fp__title">{{ folder.idea.topic }}</span>
            </div>
            <div class="fp__front-meta">
              <span class="fp__type-chip">
                <component :is="folderTypeMeta(folder.idea).icon" :size="10" weight="bold" />
                {{ folderTypeMeta(folder.idea).label }}
              </span>
              <span class="fp__date">{{ formatDate(folder.idea.createdAt) }}</span>
            </div>

            <!-- Inline mini progress bar — fills on mount -->
            <div class="fp__bar-track">
              <div class="fp__bar-fill"
                :style="{ width: (animateIn ? folder.progress.completionPct : 0) + '%' }" />
            </div>
            <div class="fp__stage-dots">
              <span v-for="stage in folder.progress.stages" :key="stage.id" class="fp__dot"
                :class="{ 'fp__dot--done': stage.done }" :title="stage.id">
                <PhCheck v-if="stage.done" :size="8" weight="bold" />
                <component v-else :is="stage.icon" :size="8" weight="regular" />
              </span>
            </div>

            <button class="fp__enter-btn" @click.stop="openFolder(folder.idea.id)">
              Enter folder
              <PhArrowRight :size="12" weight="regular" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseModal v-model="showNewFolderModal" title="New Folder" maxWidth="440px">
      <p class="modal-subtitle">Enter a topic or title for this project.</p>
      <input v-model="newFolderTopic" class="field-input" placeholder="e.g. 433MHz RC Controller"
        @keydown.enter="createFolder" autofocus />

      <p class="modal-label">Project type</p>
      <div class="type-picker">
        <button v-for="t in PROJECT_TYPES" :key="t.id" class="type-option"
          :class="{ 'type-option--active': newFolderType === t.id }" @click="newFolderType = t.id" type="button">
          <component :is="t.icon" :size="18" weight="regular" />
          {{ t.label }}
        </button>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="showNewFolderModal = false">Cancel</BaseButton>
        <BaseButton @click="createFolder" :disabled="!newFolderTopic.trim() || creating">
          {{ creating ? 'Creating…' : 'Create Folder' }}
        </BaseButton>
      </template>
    </BaseModal>

  </PageContainer>
</template>

<style scoped>
/* ── Page chrome ──────────────────────────────────────────────────────────── */
.folders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
}

.folders-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
}

.empty-sub {
  font-size: var(--font-size-sm);
  max-width: 300px;
}

.loading-state {
  padding: var(--space-2xl);
  text-align: center;
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* ── Grid — extra top gap so papers have room to fan above ────────────────── */
.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 120px 28px;
  padding-top: 40px;
}

/* ── UPGRADE 2: staggered rise-in ── */
@media (prefers-reduced-motion: no-preference) {
  .fp-rise {
    opacity: 0;
    transform: translateY(14px);
    animation: fp-rise-kf .55s cubic-bezier(.22, .61, .36, 1) forwards;
  }

  @keyframes fp-rise-kf {
    to {
      opacity: 1;
      transform: none;
    }
  }
}

/* ── Folder wrapper ───────────────────────────────────────────────────────── */
.fp {
  position: relative;
  cursor: pointer;
  outline: none;
  --accent: #7F77DD;
  --accent-deep: #534AB7;
  --accent-soft: #EEEDFE;
  --accent-edge: #AFA9EC;
}

.fp--electronics {
  --accent: #0F9D77;
  --accent-deep: #0B6E54;
  --accent-soft: #E3F6EF;
  --accent-edge: #93D9C3;
}

/* ── The folder graphic ───────────────────────────────────────────────────── */
.fp__folder {
  position: relative;
  height: 150px;
  perspective: 800px;
}

.fp__back {
  position: absolute;
  inset: 0;
  top: 16px;
  background: var(--accent-soft);
  border: 0.5px solid var(--accent-edge);
  border-radius: 4px 10px 10px 10px;
}

.fp__tab {
  position: absolute;
  top: 0;
  left: 0;
  width: 44%;
  height: 20px;
  background: var(--accent-soft);
  border: 0.5px solid var(--accent-edge);
  border-bottom: none;
  border-radius: 8px 10px 0 0;
  transform-origin: bottom left;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s;
  will-change: transform;
}

.fp:hover .fp__tab,
.fp--open .fp__tab {
  background: var(--accent-edge);
}

.fp__front {
  position: absolute;
  inset: 0;
  top: 26px;
  padding: 12px 14px;
  background: var(--color-bg-card, var(--color-background-primary));
  border: 0.5px solid var(--accent-edge);
  border-radius: 4px 10px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transform-origin: bottom center;
  transition:
    transform 0.4s cubic-bezier(0.34, 1.35, 0.64, 1),
    border-color 0.2s;
  will-change: transform;
}

.fp:hover .fp__front,
.fp--open .fp__front {
  transform: rotateX(-26deg) translateY(4px);
  border-color: var(--accent);
}

.fp__front-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.fp__front-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.fp--open-icon {
  display: none;
}

.fp:hover .fp--closed-icon,
.fp--open .fp--closed-icon {
  display: none;
}

.fp:hover .fp--open-icon,
.fp--open .fp--open-icon {
  display: inline-flex;
}

.fp__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fp__front-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.fp__date {
  font-size: 11px;
  color: var(--color-text-muted);
}

.fp__type-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent-deep);
  border: 0.5px solid var(--accent-edge);
}

.fp__bar-track {
  height: 6px;
  width: 100%;
  background: var(--accent-soft);
  border: 0.5px solid var(--accent-edge);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 2px;
}

.fp__bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
  transition: width 1s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.fp__stage-dots {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.fp__dot {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 0.5px solid var(--accent-edge);
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.fp__dot--done {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.fp__enter-btn {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 5px 12px;
  border-radius: 6px;
  border: 0.5px solid var(--accent);
  background: transparent;
  color: var(--accent-deep);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s, transform 0.2s, background 0.12s, color 0.12s;
}

.fp:hover .fp__enter-btn,
.fp--open .fp__enter-btn {
  opacity: 1;
  transform: translateY(0);
}

.fp__enter-btn:hover {
  background: var(--accent);
  color: #fff;
}

/* ── Papers fan out as a hand of cards ────────────────────────────────────── */
.fp__papers {
  position: absolute;
  bottom: calc(100% - 30px);
  left: 50%;
  width: 100%;
  height: 130px;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  z-index: 10;
}

.fp__paper {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 92px;
  height: 118px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 8px;
  background: var(--color-bg-card, var(--color-background-primary));
  border: 0.5px solid var(--accent-edge);
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(60, 52, 137, 0.12);
  font: inherit;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transform: translateX(-50%) translateY(40px) scale(0.7) rotate(0deg);
  transform-origin: bottom center;
  transition:
    opacity 0.25s calc(var(--i, 0) * 0.04s),
    transform 0.45s cubic-bezier(0.34, 1.4, 0.5, 1) calc(var(--i, 0) * 0.04s),
    background 0.12s, border-color 0.12s;
  will-change: transform, opacity;
  pointer-events: none;
}

.fp:hover .fp__paper,
.fp--open .fp__paper {
  opacity: 1;
  --spread: 64px;
  --angle: 9deg;
  --offset: calc(var(--i) - (var(--n) - 1) / 2);
  transform:
    translateX(-50%) translateX(calc(var(--offset) * var(--spread))) translateY(calc(abs(var(--offset)) * 8px)) rotate(calc(var(--offset) * var(--angle)));
  pointer-events: auto;
}

.fp__paper:hover {
  background: var(--accent-soft);
  border-color: var(--accent-edge);
  z-index: 5;
}

.fp__paper--empty {
  cursor: default;
}

.fp:hover .fp__paper--empty,
.fp--open .fp__paper--empty {
  pointer-events: none;
}

.fp__paper-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(127, 119, 221, 0.12);
  color: var(--accent);
}

.fp__paper-icon-wrap[data-type="script"] {
  background: rgba(127, 119, 221, 0.12);
  color: #534AB7;
}

.fp__paper-icon-wrap[data-type="thumbnail"] {
  background: rgba(24, 95, 165, 0.12);
  color: #185FA5;
}

.fp__paper-icon-wrap[data-type="section"] {
  background: rgba(15, 110, 86, 0.12);
  color: #0F6E56;
}

.fp__paper-icon-wrap[data-type="link"] {
  background: rgba(186, 117, 23, 0.12);
  color: #BA7517;
}

.fp__paper-icon-wrap[data-type="note"] {
  background: rgba(153, 53, 86, 0.12);
  color: #993556;
}

.fp__paper-icon-wrap[data-type="part"] {
  background: rgba(15, 157, 119, 0.12);
  color: #0B6E54;
}

.fp__paper-icon-wrap[data-type="pinout"] {
  background: rgba(24, 95, 165, 0.12);
  color: #185FA5;
}

.fp__paper-icon-wrap[data-type="log"] {
  background: rgba(186, 117, 23, 0.12);
  color: #BA7517;
}

.fp__paper-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
}

.fp__paper-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  max-width: 100%;
}

.fp__paper:hover .fp__paper-name {
  color: var(--accent-deep);
}

.fp__paper-meta {
  font-size: 9px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ── Modal ────────────────────────────────────────────────────────────────── */
.modal-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

.modal-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--space-md) 0 var(--space-xs);
}

.field-input {
  width: 100%;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-sm);
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-fast);
}

.field-input:focus {
  border-color: #7F77DD;
}

.field-input::placeholder {
  color: var(--color-text-muted);
}

.type-picker {
  display: flex;
  gap: var(--space-sm);
}

.type-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-input);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.type-option--active {
  border-color: #7F77DD;
  background: #EEEDFE;
  color: #534AB7;
}

/* ── Respect reduced motion ───────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {

  .fp-rise {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .fp__front,
  .fp__tab,
  .fp__paper,
  .fp__bar-fill {
    transition: opacity 0.15s !important;
  }

  .fp:hover .fp__front,
  .fp--open .fp__front {
    transform: none;
  }

  .fp:hover .fp__paper,
  .fp--open .fp__paper {
    transform: none;
  }
}

@media (max-width: 600px) {
  .folders-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 100px 18px;
  }
}
</style>