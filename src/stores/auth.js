import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, googleProvider, db, firebaseConfigured } from '@/services/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const accessToken = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName || '')
  const photoURL = computed(() => user.value?.photoURL || '')

  async function signInWithGoogle() {
    if (!firebaseConfigured) {
      error.value = 'Firebase is not configured. Add your credentials to .env'
      loading.value = false
      return
    }
    error.value = null
    loading.value = true
    try {
      const { signInWithPopup } = await import('firebase/auth')
      const { doc, setDoc } = await import('firebase/firestore')

      const result = await signInWithPopup(auth, googleProvider)
      const credential = result._tokenResponse
      accessToken.value = credential?.oauthAccessToken || null

      user.value = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      }

      // Store user data & token in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        lastLogin: new Date().toISOString()
      }, { merge: true })
    } catch (e) {
      error.value = e.message
      console.error('Sign-in error:', e)
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    if (!firebaseConfigured) return
    try {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
      user.value = null
      accessToken.value = null
    } catch (e) {
      error.value = e.message
    }
  }

  function initAuth() {
    if (!firebaseConfigured) {
      loading.value = false
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            user.value = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL
            }

            try {
              const { doc, getDoc } = await import('firebase/firestore')
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
              if (userDoc.exists()) {
                accessToken.value = userDoc.data().accessToken || null
              }
            } catch (e) {
              console.error('Error loading user data:', e)
            }
          } else {
            user.value = null
            accessToken.value = null
          }
          loading.value = false
          resolve()
        })
      })
    })
  }

  return {
    user,
    accessToken,
    loading,
    error,
    isAuthenticated,
    displayName,
    photoURL,
    signInWithGoogle,
    logout,
    initAuth
  }
})
