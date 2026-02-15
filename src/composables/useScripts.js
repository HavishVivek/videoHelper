import { computed, ref, watch } from 'vue'
import { useScriptsStore } from '@/stores/scripts'

export function useScripts() {
  const store = useScriptsStore()
  const autoSaveTimer = ref(null)

  const scripts = computed(() => store.sortedScripts)
  const currentScript = computed(() => store.currentScript)
  const loading = computed(() => store.loading)
  const generating = computed(() => store.generating)

  async function loadAll() {
    await store.loadScripts()
  }

  async function load(id) {
    return await store.loadScript(id)
  }

  async function save(id, content) {
    await store.saveScript(id, content)
  }

  async function remove(id) {
    await store.deleteScript(id)
  }

  function setupAutoSave(scriptId, contentRef, debounceMs = 2000) {
    watch(contentRef, (newContent) => {
      if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
      autoSaveTimer.value = setTimeout(() => {
        save(scriptId, newContent)
      }, debounceMs)
    })
  }

  return {
    scripts,
    currentScript,
    loading,
    generating,
    loadAll,
    load,
    save,
    remove,
    setupAutoSave,
    fetchThumbnails: store.fetchThumbnails,
    fetchMetadata: store.fetchMetadata
  }
}
