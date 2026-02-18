import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, firebaseConfigured } from '@/services/firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import { useAuthStore } from '@/stores/auth'

// --- localStorage helpers (userId-scoped) ---
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

  // Getters
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

  // Actions
  async function loadIdeas() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const userId = authStore.user.uid
    loading.value = true
    try {
      if (firebaseConfigured && db) {
        const q = query(
          collection(db, 'ideas'),
          where('userId', '==', userId)
        )
        const querySnapshot = await getDocs(q)
        const loadedIdeas = []
        querySnapshot.forEach((d) => {
          const idea = { id: d.id, ...d.data() }
          loadedIdeas.push(idea)
          // Keep localStorage in sync
          lsSet(userId, d.id, idea)
        })
        ideas.value = loadedIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      } else {
        // Firestore not configured — load from localStorage
        const localIdeas = lsGetAll(userId)
        ideas.value = localIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }
    } catch (e) {
      console.warn('Error loading ideas from Firestore, falling back to localStorage:', e)
      error.value = e.message
      const localIdeas = lsGetAll(userId)
      ideas.value = localIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } finally {
      loading.value = false
    }
  }

  async function addIdea(topic) {
    const authStore = useAuthStore()
    if (!authStore.user) {
      error.value = 'Must be logged in to add ideas'
      return
    }

    const userId = authStore.user.uid
    const tempId = `idea_${Date.now()}`
    const newIdea = {
      id: tempId,
      userId,
      topic,
      status: 'idea',
      notes: '',
      createdAt: new Date().toISOString(),
      scheduledScriptDate: null,
      scheduledScriptEndDate: null,
      scheduledFilmDate: null,
      scheduledFilmEndDate: null,
      scheduledPostDate: null
    }

    // Optimistic UI — add immediately so it doesn't disappear
    ideas.value.unshift(newIdea)

    try {
      if (firebaseConfigured && db) {
        const { id: _tempId, ...ideaData } = newIdea
        const docRef = await addDoc(collection(db, 'ideas'), ideaData)
        // Replace the temp entry with the real Firestore ID
        const index = ideas.value.findIndex(i => i.id === tempId)
        if (index !== -1) {
          ideas.value[index] = { ...newIdea, id: docRef.id }
        }
        // Save real ID to localStorage, clean up temp key
        lsSet(userId, docRef.id, { ...newIdea, id: docRef.id })
        lsDelete(userId, tempId)
        return ideas.value[index]
      } else {
        // Firestore not available — persist with temp ID in localStorage
        lsSet(userId, tempId, newIdea)
        return newIdea
      }
    } catch (e) {
      console.warn('Error saving idea to Firestore, keeping in localStorage:', e)
      // Keep the optimistic item and save to localStorage so it persists
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

  async function updateIdea(id, updates) {
    const authStore = useAuthStore()
    const userId = authStore.user?.uid

    // Optimistic UI update
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

    // Optimistic UI update
    const originalIdeas = [...ideas.value]
    ideas.value = ideas.value.filter(i => i.id !== id)
    if (userId) lsDelete(userId, id)

    try {
      if (firebaseConfigured && db) {
        await deleteDoc(doc(db, 'ideas', id))
      }
    } catch (e) {
      console.error('Error deleting idea:', e)
      ideas.value = originalIdeas // Revert UI
      if (userId) lsSet(userId, id, originalIdeas.find(i => i.id === id))
      error.value = e.message
    }
  }

  return {
    ideas,
    loading,
    error,
    upcomingScripting,
    upcomingFilming,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    updateSubtask
  }
})
