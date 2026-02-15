import { computed, onMounted } from 'vue'
import { useChannelStore } from '@/stores/channel'
import { useAuthStore } from '@/stores/auth'

export function useChannel() {
  const channelStore = useChannelStore()
  const authStore = useAuthStore()

  const channel = computed(() => channelStore.channel)
  const videos = computed(() => channelStore.videos)
  const topVideos = computed(() => channelStore.topVideos)
  const analysis = computed(() => channelStore.analysis)
  const loading = computed(() => channelStore.loading)
  const error = computed(() => channelStore.error)

  async function importChannel(handle) {
    await channelStore.loadChannel(handle)
  }

  async function analyze() {
    await channelStore.analyzeChannelPatterns()
  }

  function sortBy(key, ascending = false) {
    channelStore.sortVideosBy(key, ascending)
  }

  onMounted(async () => {
    if (authStore.user && !channelStore.channel) {
      await channelStore.loadCachedChannel(authStore.user.uid)
      if (channelStore.channel) {
        await channelStore.loadCachedAnalysis()
      }
    }
  })

  return {
    channel,
    videos,
    topVideos,
    analysis,
    loading,
    error,
    importChannel,
    analyze,
    sortBy
  }
}
