<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  PhMagnifyingGlass, PhSpinner, PhX, PhFolder,
  PhFileTxt, PhImage, PhVideo, PhLink, PhNote,
  PhListChecks, PhPlugs, PhClipboardText, PhArrowRight,
  PhSparkle, PhWarning, PhCode, PhGraph, PhPencilSimpleLine,
} from '@phosphor-icons/vue'

// ── Backend client ───────────────────────────────────────────────────────────
// apiPost attaches the Firebase ID token and POSTs JSON to the Node backend.
// Adjust this path if your wrapper lives elsewhere.
import { apiPost } from '@/api/client'

// ── Props ──────────────────────────────────────────────────────────────────
const props = defineProps({
  folders: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['open-folder', 'open-item'])

// ── State ──────────────────────────────────────────────────────────────────
const query = ref('')
const loading = ref(false)
const results = ref(null)
const error = ref('')
const inputEl = ref(null)
const overlayEl = ref(null)

const expanded = ref(false)
const overlay = ref(false)

// ── Helpers (corpus building stays client-side — it reads props.folders) ────
function normalizeText(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(' ')
  if (typeof value === 'object') return Object.values(value).map(normalizeText).filter(Boolean).join(' ')
  return String(value).replace(/\s+/g, ' ').trim()
}

function extractUrlKeywords(url) {
  if (!url) return ''
  try {
    const path = new URL(url).pathname
    return path
      .replace(/[-_/]+/g, ' ')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

function flattenItems(arr = [], type, keys = []) {
  return arr
    .map((item, index) => {
      const text = keys.map(k => normalizeText(item?.[k])).filter(Boolean).join(' ')
      if (!text) return null
      return {
        type,
        index,
        name: normalizeText(
          item?.title ||
          item?.name ||
          item?.label ||
          item?.filename ||
          item?.topic ||
          `${type} ${index + 1}`
        ),
        text,
      }
    })
    .filter(Boolean)
}

function buildCorpus(folders) {
  return folders.map(folder => {
    const idea = folder.idea || {}

    const board = flattenItems(
      idea.board || idea.boards || idea.boardCards || idea.boardItems || [],
      'canvas',
      ['title', 'text', 'summary', 'description', 'content', 'note', 'notes', 'label', 'prompt']
    )

    const scripts = flattenItems(folder.scripts || [], 'script', ['topic', 'title', 'text', 'summary', 'description', 'notes'])
    const thumbnails = flattenItems(idea.thumbnails || [], 'thumbnail', ['title', 'concept', 'prompt', 'description', 'text'])
    const sections = flattenItems(idea.filmedSections || [], 'section', ['name', 'description', 'notes', 'text'])
    const canvasCards = flattenItems(idea.canvasCards || [], 'canvas', ['title', 'text', 'domain', 'note', 'content', 'description'])
    const subtasks = flattenItems(idea.subtasks || [], 'subtask', ['text', 'label', 'notes', 'description'])
    const bom = flattenItems(idea.bom || [], 'part', ['name', 'partNumber', 'description', 'notes', 'text'])
    const buildLog = flattenItems(idea.buildLog || [], 'log', ['text', 'title', 'note', 'description'])
    const whiteboard = flattenItems(idea.whiteboard || [], 'note', ['title', 'text', 'label', 'note', 'content', 'description'])
    const schematics = flattenItems(idea.schematics || [], 'schematic', ['title', 'description', 'notes', 'label', 'text'])
    const codeSubfolder = flattenItems(idea.codeFiles || idea.codeSubfolder || [], 'code', ['filename', 'description', 'language', 'notes', 'content', 'text'])

    const links = (idea.links || []).map((l, index) => {
      const urlKeywords = extractUrlKeywords(l.url || '')
      const text = [
        normalizeText(l.title),
        normalizeText(l.description),
        normalizeText(l.note),
        urlKeywords,
        normalizeText(l.url),
      ].filter(Boolean).join(' ')

      return text ? {
        type: 'link',
        index,
        name: normalizeText(l.title || `link ${index + 1}`),
        text,
      } : null
    }).filter(Boolean)

    const typeLabel = idea.type || idea.projectType || folder.type || ''
    const tags = (idea.tags || folder.tags || []).join(' ')
    const status = idea.status || ''

    const groups = {
      board,
      scripts,
      thumbnails,
      sections,
      canvasCards,
      subtasks,
      bom,
      buildLog,
      links,
      whiteboard,
      schematics,
      codeSubfolder,
    }

    const allText = [
      idea.topic,
      idea.description,
      idea.summary,
      typeLabel,
      tags,
      status,
      ...Object.values(groups).flat().map(x => x.text),
    ].filter(Boolean).join(' | ')

    return {
      id: idea.id ?? folder.id,
      topic: idea.topic || folder.topic || '',
      type: typeLabel,
      tags,
      status,
      groups,
      allText,
    }
  })
}

// ── Search (AI call now lives on the backend) ───────────────────────────────
async function search() {
  const q = query.value.trim()
  if (!q) return

  overlay.value = true
  await nextTick()
  overlayEl.value?.focus()

  loading.value = true
  error.value = ''
  results.value = null

  const corpus = buildCorpus(props.folders)

  try {
    // Backend owns the Groq key, system prompt, and JSON parsing.
    // It returns { summary, matches: [{ folderId, relevance, reason, matchedItems }] }
    const data = await apiPost('/api/ai-search', { query: q, corpus })

    results.value = {
      summary: data.summary || '',
      matches: (data.matches || [])
        .map(m => ({
          ...m,
          folder: props.folders.find(f => (f.idea?.id ?? f.id) === m.folderId),
        }))
        .filter(m => m.folder),
    }
  } catch (e) {
    error.value = e.message || 'Search failed. Please try again.'
  } finally {
    loading.value = false
  }
}

// ── Open / close behaviour ─────────────────────────────────────────────────
function expandBar() {
  expanded.value = true
  nextTick(() => inputEl.value?.focus())
}

function collapseBar() {
  if (query.value) return
  expanded.value = false
}

function closeOverlay() {
  overlay.value = false
}

function openFolder(id) {
  emit('open-folder', id)
  closeOverlay()
}

function clear() {
  query.value = ''
  results.value = null
  error.value = ''
  overlay.value = false
  expanded.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape' && overlay.value) closeOverlay()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

watch(overlay, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

// ── Icon map ───────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  script: PhFileTxt,
  thumbnail: PhImage,
  section: PhVideo,
  note: PhNote,
  link: PhLink,
  part: PhListChecks,
  log: PhClipboardText,
  pinout: PhPlugs,
  subtask: PhArrowRight,
  schematic: PhGraph,
  code: PhCode,
  canvas: PhPencilSimpleLine,
}

function iconFor(type) {
  return TYPE_ICONS[type] || PhFolder
}

const relevanceOrder = { high: 0, medium: 1, low: 2 }
const sortedMatches = computed(() =>
  (results.value?.matches || [])
    .slice()
    .sort((a, b) => (relevanceOrder[a.relevance] ?? 9) - (relevanceOrder[b.relevance] ?? 9))
)
</script>

<template>
  <div class="fs">

    <!-- ── Inline trigger bar (expanding glow) ─────────────────────────── -->
    <div class="fs__bar" :class="{ 'fs__bar--expanded': expanded || query, 'fs__bar--active': loading }"
      @click="expandBar">
      <PhMagnifyingGlass class="fs__bar-icon" :size="16" weight="bold" />

      <input ref="inputEl" v-model="query" class="fs__input" placeholder="Search across all folders with AI…"
        @keydown.enter="search" @keydown.escape="clear" @blur="collapseBar" autocomplete="off" spellcheck="false" />

      <button v-if="loading" class="fs__action-btn" disabled aria-label="Loading">
        <PhSpinner class="fs__spin" :size="15" weight="bold" />
      </button>
      <button v-else-if="query" class="fs__action-btn fs__action-btn--clear" @click.stop="clear"
        aria-label="Clear search">
        <PhX :size="14" weight="bold" />
      </button>

      <button class="fs__search-btn" :disabled="!query.trim() || loading" @click.stop="search">
        <PhSparkle :size="13" weight="fill" />
        Search
      </button>
    </div>

    <!-- ── Centered clear overlay (Option B) ───────────────────────────── -->
    <Teleport to="body">
      <Transition name="fs-overlay">
        <div v-if="overlay" class="fs-overlay" @click.self="closeOverlay">

          <!-- blurred dim backdrop -->
          <div class="fs-overlay__backdrop" @click="closeOverlay" />

          <!-- clear / transparent palette -->
          <div class="fs-palette">

            <!-- palette search header -->
            <div class="fs-palette__bar">
              <PhMagnifyingGlass :size="18" weight="bold" class="fs-palette__icon" />
              <input ref="overlayEl" v-model="query" class="fs-palette__input"
                placeholder="Search across all folders with AI…" @keydown.enter="search" autocomplete="off"
                spellcheck="false" />
              <PhSpinner v-if="loading" class="fs__spin fs-palette__spin" :size="16" weight="bold" />
              <kbd class="fs-palette__kbd" @click="closeOverlay">esc</kbd>
            </div>

            <!-- palette body -->
            <div class="fs-palette__body">

              <!-- Error -->
              <div v-if="error" class="fs__error">
                <PhWarning :size="15" weight="fill" />
                {{ error }}
              </div>

              <!-- Loading -->
              <div v-else-if="loading" class="fs-palette__loading">
                <PhSpinner class="fs__spin" :size="20" weight="bold" />
                <span>Searching your folders…</span>
              </div>

              <!-- Results -->
              <template v-else-if="results !== null">
                <p class="fs__summary">
                  <PhSparkle :size="13" weight="fill" class="fs__summary-icon" />
                  {{ results.summary }}
                </p>

                <div v-if="sortedMatches.length === 0" class="fs__empty">
                  No matching folders found for <strong>"{{ query }}"</strong>
                </div>

                <div v-else class="fs__matches">
                  <div v-for="(match, mi) in sortedMatches" :key="match.folderId" class="fs__match"
                    :class="`fs__match--${match.relevance}`" :style="{ '--i': mi }">
                    <div class="fs__match-header" @click="openFolder(match.folderId)">
                      <div class="fs__match-folder-info">
                        <PhFolder :size="16" weight="fill" class="fs__match-folder-icon" />
                        <span class="fs__match-folder-name">{{ match.folder.idea?.topic || match.folder.topic }}</span>
                        <span class="fs__relevance-chip" :class="`fs__relevance-chip--${match.relevance}`">
                          {{ match.relevance }}
                        </span>
                      </div>
                      <span class="fs__match-reason">{{ match.reason }}</span>
                    </div>

                    <div v-if="match.matchedItems?.length" class="fs__match-items">
                      <div v-for="(item, i) in match.matchedItems" :key="i" class="fs__match-item"
                        @click="openFolder(match.folderId)">
                        <div class="fs__item-icon-wrap" :data-type="item.type">
                          <component :is="iconFor(item.type)" :size="11" weight="regular" />
                        </div>
                        <div class="fs__item-content">
                          <span class="fs__item-name">{{ item.name }}</span>
                          <span v-if="item.snippet" class="fs__item-snippet">{{ item.snippet }}</span>
                        </div>
                        <span class="fs__item-type-label">{{ item.type }}</span>
                      </div>
                    </div>

                    <button class="fs__open-btn" @click="openFolder(match.folderId)">
                      Open folder
                      <PhArrowRight :size="11" weight="regular" />
                    </button>
                  </div>
                </div>
              </template>

            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────────────────────── */
.fs {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Inline trigger bar (expanding glow) ───────────────────────────────── */
.fs__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e0dff8);
  border-radius: 12px;
  padding: 8px 10px 8px 14px;
  cursor: text;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.fs__bar:focus-within,
.fs__bar--expanded,
.fs__bar--active {
  border-color: #7F77DD;
  box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.12);
}

.fs__bar-icon {
  color: #7F77DD;
  flex-shrink: 0;
}

.fs__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: var(--color-text-primary);
  min-width: 0;
}

.fs__input::placeholder {
  color: var(--color-text-muted);
}

.fs__action-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.15s;
}

.fs__action-btn--clear:hover {
  color: var(--color-text-primary);
}

.fs__spin {
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fs__search-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  border-radius: 8px;
  border: none;
  background: #7F77DD;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
  flex-shrink: 0;
}

.fs__search-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.fs__search-btn:not(:disabled):hover {
  background: #534AB7;
}

/* ── Overlay (Option B: clear / transparent) ───────────────────────────── */
.fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
}

.fs-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 10, 14, 0.35);
  backdrop-filter: blur(9px) saturate(120%);
  -webkit-backdrop-filter: blur(9px) saturate(120%);
}

/* Clear palette — almost transparent, hairline borders, backdrop shows through */
.fs-palette {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.fs-palette__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 56px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.fs-palette__icon {
  color: #AFA9EC;
  flex-shrink: 0;
}

.fs-palette__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 16px;
  color: #fff;
  min-width: 0;
}

.fs-palette__input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.fs-palette__spin {
  color: #AFA9EC;
  flex-shrink: 0;
}

.fs-palette__kbd {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  padding: 2px 7px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.fs-palette__kbd:hover {
  background: rgba(255, 255, 255, 0.08);
}

.fs-palette__body {
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fs-palette__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.fs-palette__loading .fs__spin {
  color: #AFA9EC;
}

/* ── Error ─────────────────────────────────────────────────────────────── */
.fs__error {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #ffb4ab;
  background: rgba(192, 57, 43, 0.18);
  border: 1px solid rgba(245, 198, 193, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
}

/* ── Results ───────────────────────────────────────────────────────────── */
.fs__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  margin: 0;
  padding: 0 2px;
}

.fs__summary-icon {
  color: #AFA9EC;
  flex-shrink: 0;
}

.fs__empty {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  padding: 16px;
  text-align: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
}

/* ── Match cards (translucent, backdrop shows through) ─────────────────── */
.fs__matches {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fs__match {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  /* staggered entrance */
  opacity: 0;
  transform: translateY(8px);
  animation: matchIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--i) * 60ms);
}

@keyframes matchIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fs__match:hover {
  border-color: rgba(175, 169, 236, 0.6);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.fs__match--high {
  border-left: 3px solid #7F77DD;
}

.fs__match--medium {
  border-left: 3px solid #AFA9EC;
}

.fs__match--low {
  border-left: 3px solid rgba(212, 210, 245, 0.5);
}

.fs__match-header {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 14px 8px;
  cursor: pointer;
  transition: background 0.12s;
}

.fs__match-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.fs__match-folder-info {
  display: flex;
  align-items: center;
  gap: 7px;
}

.fs__match-folder-icon {
  color: #AFA9EC;
  flex-shrink: 0;
}

.fs__match-folder-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs__relevance-chip {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.fs__relevance-chip--high {
  background: rgba(127, 119, 221, .25);
  color: #d6d2ff;
  border: 0.5px solid rgba(175, 169, 236, .5);
}

.fs__relevance-chip--medium {
  background: rgba(127, 119, 221, .15);
  color: #c2bdf2;
  border: 0.5px solid rgba(212, 210, 245, .4);
}

.fs__relevance-chip--low {
  background: rgba(255, 255, 255, .06);
  color: #b3b0d6;
  border: 0.5px solid rgba(224, 223, 248, .25);
}

.fs__match-reason {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.3;
}

.fs__match-items {
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.fs__match-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  transition: background 0.1s;
}

.fs__match-item:last-child {
  border-bottom: none;
}

.fs__match-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.fs__item-icon-wrap {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(127, 119, 221, 0.18);
  color: #c2bdf2;
}

.fs__item-icon-wrap[data-type="script"] {
  background: rgba(127, 119, 221, .22);
  color: #cfc9ff;
}

.fs__item-icon-wrap[data-type="thumbnail"] {
  background: rgba(52, 152, 219, .22);
  color: #8fc7ef;
}

.fs__item-icon-wrap[data-type="section"] {
  background: rgba(29, 158, 117, .22);
  color: #7fdcba;
}

.fs__item-icon-wrap[data-type="link"] {
  background: rgba(186, 117, 23, .22);
  color: #e6b86b;
}

.fs__item-icon-wrap[data-type="note"] {
  background: rgba(153, 53, 86, .22);
  color: #e493ad;
}

.fs__item-icon-wrap[data-type="part"] {
  background: rgba(15, 157, 119, .22);
  color: #6fd6b3;
}

.fs__item-icon-wrap[data-type="log"] {
  background: rgba(186, 117, 23, .22);
  color: #e6b86b;
}

.fs__item-icon-wrap[data-type="subtask"] {
  background: rgba(127, 119, 221, .18);
  color: #c2bdf2;
}

.fs__item-icon-wrap[data-type="schematic"] {
  background: rgba(52, 152, 219, .22);
  color: #8fc7ef;
}

.fs__item-icon-wrap[data-type="code"] {
  background: rgba(39, 174, 96, .22);
  color: #7fd6a0;
}

.fs__item-icon-wrap[data-type="canvas"] {
  background: rgba(155, 89, 182, .22);
  color: #cf9fe0;
}

.fs__item-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.fs__item-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs__item-snippet {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs__item-type-label {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.fs__open-btn {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
  padding: 7px 14px;
  background: none;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #AFA9EC;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.fs__open-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #d6d2ff;
}

/* ── Overlay enter / leave ─────────────────────────────────────────────── */
.fs-overlay-enter-active,
.fs-overlay-leave-active {
  transition: opacity 0.28s ease;
}

.fs-overlay-enter-from,
.fs-overlay-leave-to {
  opacity: 0;
}

.fs-overlay-enter-active .fs-palette {
  transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s;
}

.fs-overlay-enter-from .fs-palette {
  transform: scale(0.95) translateY(-8px);
  opacity: 0;
}

/* ── Reduced motion ────────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .fs__match {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .fs__spin {
    animation: none;
  }

  .fs-overlay-enter-active .fs-palette {
    transition: none;
  }
}
</style>