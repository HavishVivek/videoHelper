import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuthStore } from '@/stores/auth'

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

    loading.value = true
    try {
      const q = query(
        collection(db, 'ideas'),
        where('userId', '==', authStore.user.uid)
      )
      
      const querySnapshot = await getDocs(q)
      const loadedIdeas = []
      querySnapshot.forEach((doc) => {
        loadedIdeas.push({ id: doc.id, ...doc.data() })
      })
      
      // Sort locally by createdAt desc
      ideas.value = loadedIdeas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
    } catch (e) {
      console.error('Error loading ideas form Firestore:', e)
      error.value = e.message
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

    const newIdea = {
      userId: authStore.user.uid,
      topic,
      status: 'idea',
      createdAt: new Date().toISOString(),
      scheduledScriptDate: null,
      scheduledFilmDate: null
    }

    try {
      const docRef = await addDoc(collection(db, 'ideas'), newIdea)
      const ideaWithId = { id: docRef.id, ...newIdea }
      ideas.value.unshift(ideaWithId)
      return ideaWithId
    } catch (e) {
      console.error('Error adding idea:', e)
      error.value = e.message
    }
  }

  async function updateIdea(id, updates) {
    // Optimistic UI update
    const index = ideas.value.findIndex(i => i.id === id)
    if (index !== -1) {
      Object.assign(ideas.value[index], updates)
    }

    try {
      const docRef = doc(db, 'ideas', id)
      await updateDoc(docRef, updates)
    } catch (e) {
      console.error('Error updating idea:', e)
      error.value = e.message
      // Revert if needed, but rarely fails unless permission error
    }
  }

  async function deleteIdea(id) {
    // Optimistic UI update
    const originalIdeas = [...ideas.value]
    ideas.value = ideas.value.filter(i => i.id !== id)

    try {
      await deleteDoc(doc(db, 'ideas', id))
    } catch (e) {
      console.error('Error deleting idea:', e)
      ideas.value = originalIdeas // Revert
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
    deleteIdea
  }
})
