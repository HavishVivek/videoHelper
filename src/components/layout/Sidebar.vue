<script setup>
import { useRoute } from 'vue-router'
import { useScriptsStore } from '@/stores/scripts'
import { computed } from 'vue'

defineProps({
  open: Boolean
})

const route = useRoute()
const scriptsStore = useScriptsStore()

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'grid' },
  { path: '/channel', label: 'Channel', icon: 'tv' },
  { path: '/generate', label: 'Generate Script', icon: 'pen' },
]

const recentScripts = computed(() => scriptsStore.sortedScripts.slice(0, 5))
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: route.path === item.path }"
      >
        <svg v-if="item.icon === 'grid'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
        <svg v-else-if="item.icon === 'tv'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="17 2 12 7 7 2" />
        </svg>
        <svg v-else-if="item.icon === 'pen'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-section" v-if="recentScripts.length">
      <h4 class="section-title">Recent Scripts</h4>
      <router-link
        v-for="script in recentScripts"
        :key="script.id"
        :to="`/editor/${script.id}`"
        class="script-link"
        :class="{ active: route.params.id === script.id }"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span class="truncate">{{ script.topic || 'Untitled' }}</span>
      </router-link>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: var(--navbar-height);
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: rgba(15, 15, 15, 0.95);
  border-right: 1px solid var(--color-border);
  padding: var(--space-lg) 0;
  transform: translateX(-100%);
  transition: transform var(--transition-base);
  z-index: 90;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: 0 var(--space-sm);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-accent-glow);
  color: var(--color-accent);
}

.sidebar-section {
  margin-top: var(--space-xl);
  padding: 0 var(--space-sm);
}

.section-title {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: 0 var(--space-md);
  margin-bottom: var(--space-sm);
}

.script-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.script-link:hover {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.script-link.active {
  color: var(--color-accent);
}

@media (max-width: 768px) {
  .sidebar {
    width: 260px;
  }
}
</style>
