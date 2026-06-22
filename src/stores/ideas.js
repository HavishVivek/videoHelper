import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, firebaseConfigured } from '@/services/firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import { useAuthStore } from '@/stores/auth'
import { PROJECT_TYPES } from '@/config/projectTypes'
import {
  syncAllIdeasToCalendar,
  syncIdeaToCalendar,
  pullEventsFromCalendar,
  deleteCalendarEvent
} from '@/services/googleCalendar'

// ─── Board columns ─────────────────────────────────────────────────────────────
export const BOARD_COLUMNS = [
  { id: 'ideas',     label: 'Ideas',     color: '#6366f1' },
  { id: 'research',  label: 'Research',  color: '#8b5cf6' },
  { id: 'planning',  label: 'Planning',  color: '#f59e0b' },
  { id: 'building',  label: 'Building',  color: '#3b82f6' },
  { id: 'testing',   label: 'Testing',   color: '#06b6d4' },
  { id: 'filming',   label: 'Filming',   color: '#f97316' },
  { id: 'editing',   label: 'Editing',   color: '#ec4899' },
  { id: 'published', label: 'Published', color: '#22c55e' },
]

export function resolveSubtaskStatus(subtask) {
  if (subtask.status) return subtask.status
  return subtask.completed ? 'published' : 'planning'
}

function lsKey(userId, id) {
  return `idea_${userId}_${id}`
}

function lsSet(userId, id, data) {
  const key = lsKey(userId, id)
  const existing = localStorage.getItem(key)
  const merged = existing ? { ...JSON.parse(existing), ...data } : data
  localStorage.setItem(key, JSON.stringify(merged))
}

function lsGetAll(userId) {
  const ideas = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`idea_${userId}_`)) {
      const data = localStorage.getItem(key)
      if (data) ideas.push(JSON.parse(data))
    }
  }
  return ideas
}

function lsDelete(userId, id) {
  localStorage.removeItem(lsKey(userId, id))
}

export const useIdeasStore = defineStore('ideas', () => {
  const ideas = ref([])
  const loading = ref(false)
  const error = ref(null)
  const syncing = ref(false)
  const syncError = ref(null)
  const googleCalendarId = ref(null)
  const autoSyncEnabled = ref(false)

  const upcomingScripting = computed(() => {
    return ideas.value
      .filter(i => i.scheduledScriptDate)
      .sort((a, b) => new Date(a.scheduledScriptDate) - new Date(b.scheduledScriptDate))
  })

  const upcomingFilming = computed(() => {
    return ideas.value
      .filter(i => i.scheduledFilmDate)
      .sort((a, b) => new Date(a.scheduledFilmDate) - new Date(b.scheduledFilmDate))
  })

  async function loadIdeas() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const userId = authStore.user.uid
    loading.value = true
    try {
      if (firebaseConfigured && db) {
        const q = query(collection(db, 'ideas'), where('userId', '==', userId))
        const querySnapshot = await getDocs(q)
        const loadedIdeas = []
        querySnapshot.forEach((d) => {
          const idea = { id: d.id, ...d.data() }
          loadedIdeas.push(idea)
          lsSet(userId, d.id, idea)
        })
        if (loadedIdeas.length === 0) {
          const localIdeas = lsGetAll(userId)
          ideas.value = localIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        } else {
          ideas.value = loadedIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }
      } else {
        const localIdeas = lsGetAll(userId)
        ideas.value = localIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }
      loadCalendarSettings()
    } catch (e) {
      console.warn('Error loading ideas from Firestore, falling back to localStorage:', e)
      error.value = e.message
      const localIdeas = lsGetAll(userId)
      ideas.value = localIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      loadCalendarSettings()
    } finally {
      loading.value = false
    }
  }

  async function addIdea(topic, type = 'youtube', isPublic = false) {
    const authStore = useAuthStore()
    if (!authStore.user) {
      error.value = 'Must be logged in to add ideas'
      return
    }

    const userId = authStore.user.uid
    const tempId = `idea_${Date.now()}`
    const typeConfig = PROJECT_TYPES[type] || PROJECT_TYPES.youtube

    const subfolders = {}
    for (const name of typeConfig.subfolders) {
      subfolders[name] = []
    }

    const subtasks = []

    const newIdea = {
      id: tempId,
      userId,
      topic,
      type,
      isPublic,
      status: 'idea',
      notes: '',
      createdAt: new Date().toISOString(),
      scheduledScriptDate: null,
      scheduledScriptEndDate: null,
      scheduledFilmDate: null,
      scheduledFilmEndDate: null,
      scheduledPostDate: null,
      subfolders,
      nestedFolders: {},
      subtasks,
      thumbnails: [],
      filmedSections: [],
      boardCards: [],
    }

    ideas.value.unshift(newIdea)

    try {
      if (firebaseConfigured && db) {
        const { id: _tempId, ...ideaData } = newIdea
        const docRef = await addDoc(collection(db, 'ideas'), ideaData)
        const index = ideas.value.findIndex(i => i.id === tempId)
        if (index !== -1) {
          ideas.value[index] = { ...newIdea, id: docRef.id }
        }
        lsSet(userId, docRef.id, { ...newIdea, id: docRef.id })
        lsDelete(userId, tempId)
        return ideas.value[index]
      } else {
        lsSet(userId, tempId, newIdea)
        return newIdea
      }
    } catch (e) {
      console.warn('Error saving idea to Firestore, keeping in localStorage:', e)
      lsSet(userId, tempId, newIdea)
      error.value = e.message
      return newIdea
    }
  }

  async function addSubtask(ideaId, text) {
    const subtask = {
      id: `st_${Date.now()}`,
      text,
      completed: false,
      status: 'not_started',
      createdAt: new Date().toISOString(),
      startDate: null,
      endDate: null
    }
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updatedSubtasks = [...(idea.subtasks || []), subtask]
    await updateIdea(ideaId, { subtasks: updatedSubtasks })
    return subtask
  }

  async function toggleSubtask(ideaId, subtaskId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updatedSubtasks = (idea.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    )
    await updateIdea(ideaId, { subtasks: updatedSubtasks })
  }

  async function deleteSubtask(ideaId, subtaskId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updatedSubtasks = (idea.subtasks || []).filter(st => st.id !== subtaskId)
    await updateIdea(ideaId, { subtasks: updatedSubtasks })
  }

  async function updateSubtask(ideaId, subtaskId, updates) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updatedSubtasks = (idea.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, ...updates } : st
    )
    await updateIdea(ideaId, { subtasks: updatedSubtasks })
  }

  async function updateSubtaskStatus(ideaId, subtaskId, newStatus) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return

    const subtask = (idea.subtasks || []).find(s => s.id === subtaskId)
    if (!subtask) return

    const prevStatus = subtask.status
    const prevCompleted = subtask.completed

    subtask.status = newStatus
    subtask.completed = newStatus === 'published'

    try {
      await updateSubtask(ideaId, subtaskId, {
        status: newStatus,
        completed: newStatus === 'published',
      })
    } catch (e) {
      subtask.status = prevStatus
      subtask.completed = prevCompleted
      throw e
    }
  }

  async function updateIdea(id, updates) {
    const authStore = useAuthStore()
    const userId = authStore.user?.uid

    const index = ideas.value.findIndex(i => i.id === id)
    if (index !== -1) {
      Object.assign(ideas.value[index], updates)
      if (userId) lsSet(userId, id, ideas.value[index])
    }

    try {
      if (firebaseConfigured && db) {
        await updateDoc(doc(db, 'ideas', id), updates)
      }
    } catch (e) {
      console.warn('Error updating idea in Firestore:', e)
      error.value = e.message
    }
  }

  async function deleteIdea(id) {
    const authStore = useAuthStore()
    const userId = authStore.user?.uid

    const idea = ideas.value.find(i => i.id === id)
    if (idea?.googleCalendarEventIds && googleCalendarId.value && authStore.accessToken) {
      try {
        const eventIds = idea.googleCalendarEventIds
        for (const type in eventIds) {
          if (eventIds[type]) {
            await deleteCalendarEvent(authStore.accessToken, googleCalendarId.value, eventIds[type])
          }
        }
      } catch (e) {
        console.warn('Error deleting calendar events:', e)
      }
    }

    const originalIdeas = [...ideas.value]
    ideas.value = ideas.value.filter(i => i.id !== id)
    if (userId) lsDelete(userId, id)

    try {
      if (firebaseConfigured && db) {
        await deleteDoc(doc(db, 'ideas', id))
      }
    } catch (e) {
      console.error('Error deleting idea:', e)
      ideas.value = originalIdeas
      if (userId) lsSet(userId, id, originalIdeas.find(i => i.id === id))
      error.value = e.message
    }
  }

  // ─── Google Calendar ───────────────────────────────────────────────────────
  async function syncToGoogleCalendar() {
    const authStore = useAuthStore()
    if (!authStore.accessToken) {
      syncError.value = 'Not authenticated with Google'
      return false
    }
    syncing.value = true
    syncError.value = null
    try {
      const result = await syncAllIdeasToCalendar(authStore.accessToken, ideas.value, googleCalendarId.value)
      googleCalendarId.value = result.calendarId
      ideas.value = result.ideas
      const userId = authStore.user?.uid
      if (userId) {
        for (const idea of result.ideas) {
          lsSet(userId, idea.id, idea)
          if (firebaseConfigured && db) {
            try {
              await updateDoc(doc(db, 'ideas', idea.id), {
                googleCalendarEventIds: idea.googleCalendarEventIds,
                googleCalendarId: idea.googleCalendarId
              })
            } catch (e) {
              console.warn('Error updating Firestore with calendar IDs:', e)
            }
          }
        }
        localStorage.setItem(`googleCalendarId_${userId}`, result.calendarId)
      }
      return true
    } catch (e) {
      console.error('Error syncing to Google Calendar:', e)
      syncError.value = e.message
      return false
    } finally {
      syncing.value = false
    }
  }

  async function syncSingleIdea(ideaId) {
    const authStore = useAuthStore()
    if (!authStore.accessToken || !googleCalendarId.value) return
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    try {
      const eventIds = await syncIdeaToCalendar(
        authStore.accessToken, googleCalendarId.value, idea, idea.googleCalendarEventIds || {}
      )
      const index = ideas.value.findIndex(i => i.id === ideaId)
      if (index !== -1) {
        ideas.value[index].googleCalendarEventIds = eventIds
        ideas.value[index].googleCalendarId = googleCalendarId.value
        const userId = authStore.user?.uid
        if (userId) {
          lsSet(userId, ideaId, ideas.value[index])
          if (firebaseConfigured && db) {
            await updateDoc(doc(db, 'ideas', ideaId), {
              googleCalendarEventIds: eventIds,
              googleCalendarId: googleCalendarId.value
            })
          }
        }
      }
    } catch (e) {
      console.error('Error syncing single idea:', e)
    }
  }

  async function pullFromGoogleCalendar() {
    const authStore = useAuthStore()
    if (!authStore.accessToken || !googleCalendarId.value) {
      syncError.value = 'Calendar not synced yet'
      return false
    }
    syncing.value = true
    syncError.value = null
    try {
      const updates = await pullEventsFromCalendar(authStore.accessToken, googleCalendarId.value, ideas.value)
      for (const { ideaId, updates: ideaUpdates } of updates) {
        await updateIdea(ideaId, ideaUpdates)
      }
      return true
    } catch (e) {
      console.error('Error pulling from Google Calendar:', e)
      syncError.value = e.message
      return false
    } finally {
      syncing.value = false
    }
  }

  async function enableAutoSync() {
    autoSyncEnabled.value = true
    const authStore = useAuthStore()
    const userId = authStore.user?.uid
    if (userId) localStorage.setItem(`autoSyncEnabled_${userId}`, 'true')
  }

  async function disableAutoSync() {
    autoSyncEnabled.value = false
    const authStore = useAuthStore()
    const userId = authStore.user?.uid
    if (userId) localStorage.setItem(`autoSyncEnabled_${userId}`, 'false')
  }

  // ─── Thumbnails ────────────────────────────────────────────────────────────
  async function addIdeaThumbnail(ideaId, thumbnail) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const newThumb = {
      id: `thumb_${Date.now()}`,
      title: thumbnail.title || '',
      concept: thumbnail.concept || '',
      notes: thumbnail.notes || '',
      createdAt: new Date().toISOString()
    }
    const updated = [...(idea.thumbnails || []), newThumb]
    await updateIdea(ideaId, { thumbnails: updated })
    return newThumb
  }

  async function updateIdeaThumbnail(ideaId, thumbId, updates) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updated = (idea.thumbnails || []).map(t => t.id === thumbId ? { ...t, ...updates } : t)
    await updateIdea(ideaId, { thumbnails: updated })
  }

  async function deleteIdeaThumbnail(ideaId, thumbId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updated = (idea.thumbnails || []).filter(t => t.id !== thumbId)
    await updateIdea(ideaId, { thumbnails: updated })
  }

  // ─── Filmed sections ───────────────────────────────────────────────────────
  async function addFilmedSection(ideaId, section) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const newSection = {
      id: `section_${Date.now()}`,
      name: section.name || 'New Section',
      status: 'not_filmed',
      notes: section.notes || '',
      duration: section.duration || '',
      order: (idea.filmedSections || []).length,
      createdAt: new Date().toISOString()
    }
    const updated = [...(idea.filmedSections || []), newSection]
    await updateIdea(ideaId, { filmedSections: updated })
    return newSection
  }

  async function updateFilmedSection(ideaId, sectionId, updates) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updated = (idea.filmedSections || []).map(s => s.id === sectionId ? { ...s, ...updates } : s)
    await updateIdea(ideaId, { filmedSections: updated })
  }

  async function deleteFilmedSection(ideaId, sectionId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const updated = (idea.filmedSections || []).filter(s => s.id !== sectionId)
    await updateIdea(ideaId, { filmedSections: updated })
  }

  // ─── Flat subfolder items (legacy / simple lists) ──────────────────────────
  async function addSubfolderItem(ideaId, folderName, item) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const newItem = {
      id: `item_${Date.now()}`,
      text: item.text || '',
      completed: false,
      createdAt: new Date().toISOString(),
      ...item,
    }
    const current = idea.subfolders?.[folderName] || []
    const updatedSubfolders = {
      ...(idea.subfolders || {}),
      [folderName]: [...current, newItem],
    }
    await updateIdea(ideaId, { subfolders: updatedSubfolders })
    return newItem
  }

  async function updateSubfolderItem(ideaId, folderName, itemId, updates) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const current = idea.subfolders?.[folderName] || []
    const updatedSubfolders = {
      ...(idea.subfolders || {}),
      [folderName]: current.map(item => item.id === itemId ? { ...item, ...updates } : item),
    }
    await updateIdea(ideaId, { subfolders: updatedSubfolders })
  }

  async function deleteSubfolderItem(ideaId, folderName, itemId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const current = idea.subfolders?.[folderName] || []
    const updatedSubfolders = {
      ...(idea.subfolders || {}),
      [folderName]: current.filter(item => item.id !== itemId),
    }
    await updateIdea(ideaId, { subfolders: updatedSubfolders })
  }

  // ─── Nested folder actions ─────────────────────────────────────────────────
  // Data: idea.nestedFolders[folderName][nestedId] = { id, name, createdAt, items[] }

  async function addNestedFolder(ideaId, folderName, name) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const id = `nf_${Date.now()}`
    const newFolder = { id, name, createdAt: new Date().toISOString(), items: [] }
    const existing = idea.nestedFolders?.[folderName] || {}
    const updatedNestedFolders = {
      ...(idea.nestedFolders || {}),
      [folderName]: { ...existing, [id]: newFolder },
    }
    await updateIdea(ideaId, { nestedFolders: updatedNestedFolders })
    return newFolder
  }

  async function updateNestedFolder(ideaId, folderName, nestedId, updates) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const existing = idea.nestedFolders?.[folderName]?.[nestedId]
    if (!existing) return
    const updatedNestedFolders = {
      ...(idea.nestedFolders || {}),
      [folderName]: {
        ...(idea.nestedFolders?.[folderName] || {}),
        [nestedId]: { ...existing, ...updates },
      },
    }
    await updateIdea(ideaId, { nestedFolders: updatedNestedFolders })
  }

  async function deleteNestedFolder(ideaId, folderName, nestedId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const folderMap = { ...(idea.nestedFolders?.[folderName] || {}) }
    delete folderMap[nestedId]
    const updatedNestedFolders = {
      ...(idea.nestedFolders || {}),
      [folderName]: folderMap,
    }
    await updateIdea(ideaId, { nestedFolders: updatedNestedFolders })
  }

  async function addNestedFolderItem(ideaId, folderName, nestedId, item) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const nested = idea.nestedFolders?.[folderName]?.[nestedId]
    if (!nested) return
    const newItem = {
      id: `nfi_${Date.now()}`,
      title: item.title || '',
      notes: item.notes || '',
      createdAt: new Date().toISOString(),
      ...item,
    }
    const updatedItems = [...(nested.items || []), newItem]
    await updateNestedFolder(ideaId, folderName, nestedId, { items: updatedItems })
    return newItem
  }

  async function updateNestedFolderItem(ideaId, folderName, nestedId, itemId, updates) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const nested = idea.nestedFolders?.[folderName]?.[nestedId]
    if (!nested) return
    const updatedItems = (nested.items || []).map(it =>
      it.id === itemId ? { ...it, ...updates } : it
    )
    await updateNestedFolder(ideaId, folderName, nestedId, { items: updatedItems })
  }

  async function deleteNestedFolderItem(ideaId, folderName, nestedId, itemId) {
    const idea = ideas.value.find(i => i.id === ideaId)
    if (!idea) return
    const nested = idea.nestedFolders?.[folderName]?.[nestedId]
    if (!nested) return
    const updatedItems = (nested.items || []).filter(it => it.id !== itemId)
    await updateNestedFolder(ideaId, folderName, nestedId, { items: updatedItems })
  }

  // ─── Calendar settings ─────────────────────────────────────────────────────
  function loadCalendarSettings() {
    const authStore = useAuthStore()
    const userId = authStore.user?.uid
    if (userId) {
      const calId = localStorage.getItem(`googleCalendarId_${userId}`)
      if (calId) googleCalendarId.value = calId
      const autoSync = localStorage.getItem(`autoSyncEnabled_${userId}`)
      autoSyncEnabled.value = autoSync === 'true'
    }
  }

  return {
    ideas,
    loading,
    error,
    syncing,
    syncError,
    googleCalendarId,
    autoSyncEnabled,
    upcomingScripting,
    upcomingFilming,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    updateSubtask,
    updateSubtaskStatus,
    syncToGoogleCalendar,
    syncSingleIdea,
    pullFromGoogleCalendar,
    enableAutoSync,
    disableAutoSync,
    loadCalendarSettings,
    addIdeaThumbnail,
    updateIdeaThumbnail,
    deleteIdeaThumbnail,
    addFilmedSection,
    updateFilmedSection,
    deleteFilmedSection,
    addSubfolderItem,
    updateSubfolderItem,
    deleteSubfolderItem,
    addNestedFolder,
    updateNestedFolder,
    deleteNestedFolder,
    addNestedFolderItem,
    updateNestedFolderItem,
    deleteNestedFolderItem,
  }
})