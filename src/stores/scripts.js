import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, firebaseConfigured } from '@/services/firebase'
import { generateIntroVariations, generateFullScript, getEditingFeedback, predictPerformance, streamFullScript, generateScriptVariations as generateScriptVariationsAPI, generateThumbnailConcepts, generateMetadata } from '@/services/groq'
import { useAuthStore } from './auth'
import { useChannelStore } from './channel'

// LocalStorage fallback functions
function lsSet(path, id, data) {
  const key = `${path}_${id}`
  const existing = localStorage.getItem(key)
  const merged = existing ? { ...JSON.parse(existing), ...data } : data
  localStorage.setItem(key, JSON.stringify(merged))
}

function lsGet(path, id) {
  const key = `${path}_${id}`
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

function lsGetAll(path) {
  const scripts = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`${path}_`)) {
      const data = localStorage.getItem(key)
      if (data) {
        const parsed = JSON.parse(data)
        scripts.push(parsed)
      }
    }
  }
  return scripts
}

function lsDelete(path, id) {
  const key = `${path}_${id}`
  localStorage.removeItem(key)
}

// Firebase functions with localStorage fallback strategy
async function fsSet(path, id, data) {
  if (firebaseConfigured && db) {
    try {
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, path, id), data, { merge: true })
      return
    } catch (e) {
      console.warn(`Firebase set failed for ${path}/${id}, falling back to LocalStorage:`, e)
    }
  }
  // Fallback (or if not configured)
  lsSet(path, id, data)
}

async function fsGet(path, id) {
  if (firebaseConfigured && db) {
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const snap = await getDoc(doc(db, path, id))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    } catch (e) {
      console.warn(`Firebase get failed for ${path}/${id}, falling back to LocalStorage:`, e)
    }
  }
  // Fallback
  return lsGet(path, id)
}

async function fsGetAll(path) {
  if (firebaseConfigured && db) {
    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const snap = await getDocs(collection(db, path))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch (e) {
      console.warn(`Firebase getAll failed for ${path}, falling back to LocalStorage:`, e)
    }
  }
  // Fallback
  return lsGetAll(path)
}

async function fsDelete(path, id) {
  if (firebaseConfigured && db) {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore')
      await deleteDoc(doc(db, path, id))
      return
    } catch (e) {
      console.warn(`Firebase delete failed for ${path}/${id}, falling back to LocalStorage:`, e)
    }
  }
  // Fallback
  lsDelete(path, id)
}

export const useScriptsStore = defineStore('scripts', () => {
  const scripts = ref([])
  const currentScript = ref(null)
  const introVariations = ref([])
  const scriptVariations = ref([])
  const editingFeedback = ref(null)
  const prediction = ref(null)
  const loading = ref(false)
  const generating = ref(false)
  const error = ref(null)

  const sortedScripts = computed(() => {
    return [...scripts.value].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  })

  async function loadScripts() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    try {
      const all = await fsGetAll('scripts')
      scripts.value = all.filter(d => d.userId === authStore.user.uid)
    } catch (e) {
      console.error('Load scripts error:', e)
    }
  }

  async function loadScript(scriptId) {
    console.log('Loading script with ID:', scriptId)
    try {
      const data = await fsGet('scripts', scriptId)
      if (data) {
        console.log('Script loaded successfully:', data.id)
        currentScript.value = data
        return currentScript.value
      } else {
        console.warn('Script not found:', scriptId)
      }
    } catch (e) {
      console.error('Error loading script:', e)
      error.value = e.message
    }
    return null
  }

  async function generateIntros(topic, notes = '') {
    const channelStore = useChannelStore()
    loading.value = true
    error.value = null

    try {
      const result = await generateIntroVariations(topic, channelStore.analysis, notes)
      introVariations.value = Array.isArray(result) ? result : []
      return introVariations.value
    } catch (e) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  async function generateScript(topic, selectedIntro) {
    const authStore = useAuthStore()
    const channelStore = useChannelStore()
    generating.value = true
    error.value = null

    try {
      const content = await generateFullScript(topic, selectedIntro, channelStore.analysis)

      const scriptId = `script_${Date.now()}`
      const scriptData = {
        userId: authStore.user?.uid || 'anonymous',
        channelId: channelStore.channel?.id || null,
        topic,
        selectedIntro,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await fsSet('scripts', scriptId, scriptData)
      currentScript.value = { id: scriptId, ...scriptData }
      scripts.value.push(currentScript.value)

      return currentScript.value
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      generating.value = false
    }
  }

  async function* streamScript(topic, selectedIntro) {
    const authStore = useAuthStore()
    const channelStore = useChannelStore()
    generating.value = true
    error.value = null

    try {
      let fullContent = ''
      for await (const chunk of streamFullScript(topic, selectedIntro, channelStore.analysis)) {
        fullContent += chunk
        yield chunk
      }

      const scriptId = `script_${Date.now()}`
      const scriptData = {
        userId: authStore.user?.uid || 'anonymous',
        channelId: channelStore.channel?.id || null,
        topic,
        selectedIntro,
        content: fullContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await fsSet('scripts', scriptId, scriptData)
      currentScript.value = { id: scriptId, ...scriptData }
      scripts.value.push(currentScript.value)
    } catch (e) {
      error.value = e.message
    } finally {
      generating.value = false
    }
  }

  async function generateScriptVariations(topic, selectedIntro) {
    const channelStore = useChannelStore()
    loading.value = true
    error.value = null

    try {
      const result = await generateScriptVariationsAPI(topic, selectedIntro, channelStore.analysis)
      scriptVariations.value = Array.isArray(result) ? result : []
      return scriptVariations.value
    } catch (e) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  async function selectScriptVariation(topic, selectedIntro, variationContent) {
    console.log('=== selectScriptVariation START ===')
    const authStore = useAuthStore()
    const channelStore = useChannelStore()
    
    console.log('Auth user:', authStore.user)
    console.log('Channel:', channelStore.channel)
    console.log('Input params:', { 
      topic, 
      selectedIntro: selectedIntro?.substring(0, 50) + '...', 
      contentLength: variationContent?.length 
    })
    
    if (!variationContent) {
      console.error('No variation content provided!')
      error.value = 'No script content provided'
      return null
    }
    
    generating.value = true
    error.value = null

    try {
      const scriptId = `script_${Date.now()}`
      const scriptData = {
        id: scriptId,
        userId: authStore.user?.uid || 'anonymous',
        channelId: channelStore.channel?.id || null,
        topic,
        selectedIntro,
        content: variationContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      console.log('Creating script with ID:', scriptId)
      console.log('Script data:', { ...scriptData, content: scriptData.content.substring(0, 100) + '...' })
      
      await fsSet('scripts', scriptId, scriptData)
      console.log('fsSet completed')
      
      currentScript.value = { id: scriptId, ...scriptData }
      scripts.value.push(currentScript.value)

      console.log('Script created successfully:', currentScript.value.id)
      console.log('=== selectScriptVariation SUCCESS ===')
      return currentScript.value
    } catch (e) {
      console.error('=== selectScriptVariation ERROR ===')
      console.error('Error creating script:', e)
      console.error('Error message:', e.message)
      console.error('Error stack:', e.stack)
      error.value = e.message
      return null
    } finally {
      generating.value = false
    }
  }

  async function createManualScript(topic, content) {
    const authStore = useAuthStore()
    const channelStore = useChannelStore()
    generating.value = true
    error.value = null

    try {
      const scriptId = `script_${Date.now()}`
      const scriptData = {
        id: scriptId,
        userId: authStore.user?.uid || 'anonymous',
        channelId: channelStore.channel?.id || null,
        topic,
        content,
        isManual: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await fsSet('scripts', scriptId, scriptData)
      currentScript.value = { id: scriptId, ...scriptData }
      scripts.value.push(currentScript.value)

      return currentScript.value
    } catch (e) {
      console.error('Error creating manual script:', e)
      error.value = e.message
      return null
    } finally {
      generating.value = false
    }
  }

  async function saveScript(scriptId, content) {
    try {
      await fsSet('scripts', scriptId, {
        content,
        updatedAt: new Date().toISOString()
      })

      if (currentScript.value?.id === scriptId) {
        currentScript.value.content = content
        currentScript.value.updatedAt = new Date().toISOString()
      }
    } catch (e) {
      error.value = e.message
    }
  }

  async function deleteScript(scriptId) {
    try {
      await fsDelete('scripts', scriptId)
      scripts.value = scripts.value.filter(s => s.id !== scriptId)
      if (currentScript.value?.id === scriptId) {
        currentScript.value = null
      }
    } catch (e) {
      error.value = e.message
    }
  }

  async function fetchEditingFeedback(content, sectionType = 'body') {
    try {
      editingFeedback.value = await getEditingFeedback(content, sectionType)
      return editingFeedback.value
    } catch (e) {
      console.error('Feedback error:', e)
      return null
    }
  }

  async function fetchPrediction(content) {
    const channelStore = useChannelStore()
    if (!channelStore.channel) return null

    loading.value = true
    try {
      prediction.value = await predictPerformance(content, channelStore.channel, channelStore.topVideos)

      if (currentScript.value) {
        await fsSet('scripts', currentScript.value.id, {
          prediction: prediction.value,
          predictedAt: new Date().toISOString()
        })
      }

      return prediction.value
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchThumbnails(scriptIdParam = null) {
    // Use provided script ID or fall back to currentScript
    const scriptId = scriptIdParam || currentScript.value?.id
    if (!scriptId) return

    // Load the script data if we don't have it
    let scriptData = scripts.value.find(s => s.id === scriptId)
    if (!scriptData) {
      scriptData = await fsGet('scripts', scriptId)
      if (!scriptData) return
      // Add to scripts array if not present
      scripts.value.push(scriptData)
    }

    generating.value = true
    try {
      const thumbnails = await generateThumbnailConcepts(scriptData.content, scriptData.topic)

      // Update store state
      const script = scripts.value.find(s => s.id === scriptId)
      if (script) script.thumbnails = thumbnails
      if (currentScript.value?.id === scriptId) currentScript.value.thumbnails = thumbnails

      // Update in storage
      await fsSet('scripts', scriptId, { thumbnails })

      return thumbnails
    } catch (e) {
      console.error('Thumbnail error:', e)
      error.value = e.message
      return []
    } finally {
      generating.value = false
    }
  }

  async function fetchMetadata(scriptIdParam = null) {
    // Use provided script ID or fall back to currentScript
    const scriptId = scriptIdParam || currentScript.value?.id
    if (!scriptId) return

    // Load the script data if we don't have it
    let scriptData = scripts.value.find(s => s.id === scriptId)
    if (!scriptData) {
      scriptData = await fsGet('scripts', scriptId)
      if (!scriptData) return
      // Add to scripts array if not present
      scripts.value.push(scriptData)
    }

    generating.value = true
    try {
      const metadata = await generateMetadata(scriptData.content, scriptData.topic)

      // Update store state
      const script = scripts.value.find(s => s.id === scriptId)
      if (script) script.metadata = metadata
      if (currentScript.value?.id === scriptId) currentScript.value.metadata = metadata

      // Update in storage
      await fsSet('scripts', scriptId, { metadata })

      return metadata
    } catch (e) {
      console.error('Metadata error:', e)
      error.value = e.message
      return null
    } finally {
      generating.value = false
    }
  }

  async function updateScript(id, updates) {
    try {
      if (!updates.updatedAt) {
        updates.updatedAt = new Date().toISOString()
      }
      
      await fsSet('scripts', id, updates)
      
      const script = scripts.value.find(s => s.id === id)
      if (script) Object.assign(script, updates)
      if (currentScript.value?.id === id) Object.assign(currentScript.value, updates)
      
    } catch (e) {
      console.error('Update script error:', e)
      error.value = e.message
    }
  }

  return {
    scripts,
    currentScript,
    introVariations,
    scriptVariations,
    editingFeedback,
    prediction,
    loading,
    generating,
    error,
    sortedScripts,
    loadScripts,
    loadScript,
    generateIntros,
    generateScript,
    generateScriptVariations,
    selectScriptVariation,
    createManualScript,
    streamScript,
    saveScript,
    updateScript,
    deleteScript,
    fetchEditingFeedback,
    fetchPrediction,
    fetchThumbnails,
    fetchMetadata
  }
})
