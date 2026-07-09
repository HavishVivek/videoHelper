<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'
import PageContainer from '@/components/layout/PageContainer.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import VueFeather from 'vue-feather'
import { PROJECT_TYPES } from '@/config/projectTypes'
import SubfolderSection from './Subfoldersection.vue'
import BoardCanvas from '@/components/board/Boardcanvas.vue'

const route = useRoute()
const router = useRouter()
const store = useIdeasStore()

const loading = ref(true)

onMounted(async () => {
  await store.loadIdeas()
  loading.value = false
})

const idea = computed(() =>
  store.ideas.find(i => i.id === route.params.id) || null
)

const folders = computed(() => {
  if (!idea.value) return []
  const cfg = PROJECT_TYPES[idea.value.type] || PROJECT_TYPES['youtube']
  return cfg.subfolders
})

// A blank project has no subfolders — it gets a board + a loose "files" store
const isBlank = computed(() => folders.value.length === 0)

// Board is always the first tab, folders follow.
// Blank projects get a single "files" tab for loose storage instead of subfolders.
const tabs = computed(() => {
  if (!idea.value) return []
  if (isBlank.value) return ['board', 'files']
  return ['board', ...folders.value]
})

// Which tab we land on by default.
// Blank projects land INSIDE the files store; everything else lands on the board.
const defaultTab = computed(() => (isBlank.value ? 'files' : 'board'))

// ?tab= overrides the default when it points to a valid tab
const activeTab = computed(() => {
  const t = route.query.tab
  if (t && tabs.value.includes(t)) return t
  return defaultTab.value
})

function selectTab(name) {
  // Landing on the default tab == no query needed, so drop it for a clean URL
  if (name === defaultTab.value) {
    router.replace({ path: route.path })
  } else {
    router.replace({ path: route.path, query: { ...route.query, tab: name } })
  }
}

function tabIcon(name) {
  if (name === 'board') return 'layout'
  if (name === 'files') return 'folder'
  const icons = {
    scripts: 'file-text', thumbnails: 'image', clips: 'film', footage: 'video',
    audio: 'mic', exports: 'package', assets: 'folder', docs: 'file-text',
    schematics: 'cpu', code: 'code', research: 'search', mockups: 'pen-tool',
    references: 'book', notes: 'edit-3', renders: 'aperture',
  }
  return icons[name?.toLowerCase()] || 'folder'
}

function goBack() {
  router.push('/folders')
}
</script>

<template>
  <PageContainer>
    <div v-if="loading" class="ifv-state">
      <p class="ifv-muted">Loading project…</p>
    </div>

    <div v-else-if="!idea" class="ifv-state">
      <GlassCard :hover="false" padding="lg">
        <h2>Project not found</h2>
        <p class="ifv-muted">This project doesn't exist or was deleted.</p>
        <BaseButton @click="goBack">← Back to Folders</BaseButton>
      </GlassCard>
    </div>

    <template v-else>
      <div class="ifv-header">
        <button class="ifv-back" @click="goBack">
          <vue-feather type="arrow-left" size="16" /> Folders
        </button>
        <h1 class="ifv-title">{{ idea.topic }}</h1>
      </div>

      <div class="ifv-tabs">
        <button v-for="name in tabs" :key="name" class="ifv-tab" :class="{ active: activeTab === name }"
          @click="selectTab(name)">
          <vue-feather :type="tabIcon(name)" size="14" />
          {{ name === 'board' ? 'Board' : name }}
        </button>
      </div>

      <!-- Board (whiteboard) -->
      <BoardCanvas v-if="activeTab === 'board'" :ideaId="idea.id" />

      <!-- Otherwise the file/folder view for the active tab.
           Blank projects use a single "files" folder for loose storage. -->
      <SubfolderSection v-else :key="activeTab" :ideaId="idea.id" :folderName="activeTab" />
    </template>
  </PageContainer>
</template>

<style scoped>
.ifv-state {
  padding-top: var(--space-2xl);
  text-align: center;
}

.ifv-muted {
  color: var(--color-text-muted);
}

.ifv-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
}

.ifv-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  transition: color 0.15s;
}

.ifv-back:hover {
  color: var(--color-accent);
}

.ifv-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
}

.ifv-tabs {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
  margin-bottom: var(--space-xl);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-sm);
}

.ifv-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.15s;
}

.ifv-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
}

.ifv-tab.active {
  background: var(--color-bg-card);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>