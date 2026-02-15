import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  const isAuthenticated = computed(() => store.isAuthenticated)
  const user = computed(() => store.user)
  const loading = computed(() => store.loading)

  async function signIn() {
    await store.signInWithGoogle()
    if (store.isAuthenticated) {
      router.push('/channel')
    }
  }

  async function signOut() {
    await store.logout()
    router.push('/')
  }

  return {
    isAuthenticated,
    user,
    loading,
    signIn,
    signOut
  }
}
