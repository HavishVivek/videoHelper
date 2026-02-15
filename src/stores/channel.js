import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, firebaseConfigured } from '@/services/firebase'
import { fetchChannelByHandle, fetchVideos } from '@/services/youtube'
import { analyzeChannel } from '@/services/groq'
import { useAuthStore } from './auth'

async function firestoreSet(path, id, data) {
  if (!firebaseConfigured || !db) return
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, path, id), data, { merge: true })
}

export const useChannelStore = defineStore('channel', () => {
  const channel = ref(null)
  const videos = ref([])
  const analysis = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const topVideos = computed(() => {
    return [...videos.value]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10)
  })

  const averageViews = computed(() => {
    if (!videos.value.length) return 0
    return Math.round(videos.value.reduce((sum, v) => sum + v.viewCount, 0) / videos.value.length)
  })

  const totalViews = computed(() => {
    return videos.value.reduce((sum, v) => sum + v.viewCount, 0)
  })

  async function loadChannel(handle) {
    if (!handle) throw new Error('Please enter a channel handle')

    loading.value = true
    error.value = null

    try {
      channel.value = await fetchChannelByHandle(handle)

      const authStore = useAuthStore()
      const userId = authStore.user?.uid

      // Cache to Firestore (non-blocking — don't let this prevent video fetch)
      firestoreSet('channels', channel.value.id, {
        ...channel.value,
        ...(userId && { userId }),
        updatedAt: new Date().toISOString()
      }).catch(e => console.warn('Firestore channel cache failed:', e))

      videos.value = await fetchVideos(channel.value.uploadsPlaylistId)

      // Cache videos to Firestore (non-blocking)
      for (const video of videos.value) {
        firestoreSet('videos', video.id, {
          ...video,
          channelId: channel.value.id,
          ...(userId && { userId }),
          updatedAt: new Date().toISOString()
        }).catch(e => console.warn('Firestore video cache failed:', e))
      }
    } catch (e) {
      error.value = e.message
      console.error('Channel load error:', e)
    } finally {
      loading.value = false
    }
  }

  async function loadCachedChannel(userId) {
    if (!firebaseConfigured || !db) return
    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const channelsSnapshot = await getDocs(collection(db, 'channels'))
      const userChannel = channelsSnapshot.docs.find(d => d.data().userId === userId)
      if (userChannel) {
        channel.value = userChannel.data()
        const videosSnapshot = await getDocs(collection(db, 'videos'))
        videos.value = videosSnapshot.docs
          .filter(d => d.data().channelId === channel.value.id)
          .map(d => d.data())
      }
    } catch (e) {
      console.error('Cache load error:', e)
    }
  }

  async function analyzeChannelPatterns() {
    if (!channel.value) {
      error.value = 'No channel loaded'
      return
    }
    if (!topVideos.value.length) {
      error.value = 'No videos found — import the channel again to fetch videos'
      return
    }

    loading.value = true
    try {
      const result = await analyzeChannel(channel.value, topVideos.value)
      analysis.value = result

      await firestoreSet('analyses', channel.value.id, {
        channelId: channel.value.id,
        analysis: result,
        analyzedAt: new Date().toISOString()
      })
    } catch (e) {
      error.value = e.message
      console.error('Analysis error:', e)
    } finally {
      loading.value = false
    }
  }

  async function loadCachedAnalysis() {
    if (!firebaseConfigured || !db || !channel.value) return
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const analysisDoc = await getDoc(doc(db, 'analyses', channel.value.id))
      if (analysisDoc.exists()) {
        analysis.value = analysisDoc.data().analysis
      }
    } catch (e) {
      console.error('Cache analysis load error:', e)
    }
  }

  function sortVideosBy(key, ascending = false) {
    videos.value.sort((a, b) => ascending ? a[key] - b[key] : b[key] - a[key])
  }

  return {
    channel,
    videos,
    analysis,
    loading,
    error,
    topVideos,
    averageViews,
    totalViews,
    loadChannel,
    loadCachedChannel,
    analyzeChannelPatterns,
    loadCachedAnalysis,
    sortVideosBy
  }
})
