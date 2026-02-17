import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'

// Simple local storage fallback if firebase fails or not configured
const STORAGE_KEY = 'video_helper_ideas'

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
    loading.value = true
    try {
      // Try local storage first/fallback for now to ensure speed
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        ideas.value = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Error loading ideas:', e)
    } finally {
      loading.value = false
    }
  }

  async function addIdea(topic) {
    const newIdea = {
      id: Date.now().toString(),
      topic,
      status: 'idea', // idea, scripting, filming, done
      createdAt: new Date().toISOString(),
      scheduledScriptDate: null,
      scheduledFilmDate: null
    }
    
    ideas.value.unshift(newIdea)
    saveToStorage()
    return newIdea
  }

  async function updateIdea(id, updates) {
    const index = ideas.value.findIndex(i => i.id === id)
    if (index !== -1) {
      ideas.value[index] = { ...ideas.value[index], ...updates }
      saveToStorage()
    }
  }

  async function deleteIdea(id) {
    ideas.value = ideas.value.filter(i => i.id !== id)
    saveToStorage()
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas.value))
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
