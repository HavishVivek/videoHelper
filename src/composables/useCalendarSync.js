import { computed } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import { useAuthStore } from '@/stores/auth'

/**
 * Composable for Google Calendar sync functionality
 */
export function useCalendarSync() {
  const ideasStore = useIdeasStore()
  const authStore = useAuthStore()

  const isSynced = computed(() => !!ideasStore.googleCalendarId)
  const isAutoSyncEnabled = computed(() => ideasStore.autoSyncEnabled)
  const syncing = computed(() => ideasStore.syncing)
  const syncError = computed(() => ideasStore.syncError)
  const canSync = computed(() => !!authStore.accessToken && !ideasStore.syncing)

  async function syncToCalendar() {
    return await ideasStore.syncToGoogleCalendar()
  }

  async function pullFromCalendar() {
    return await ideasStore.pullFromGoogleCalendar()
  }

  async function enableAutoSync() {
    await ideasStore.enableAutoSync()
  }

  async function disableAutoSync() {
    await ideasStore.disableAutoSync()
  }

  async function toggleAutoSync() {
    if (ideasStore.autoSyncEnabled) {
      await disableAutoSync()
    } else {
      await enableAutoSync()
    }
  }

  return {
    isSynced,
    isAutoSyncEnabled,
    syncing,
    syncError,
    canSync,
    syncToCalendar,
    pullFromCalendar,
    enableAutoSync,
    disableAutoSync,
    toggleAutoSync
  }
}
