<script setup>
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits(['toggle-sidebar'])
const authStore = useAuthStore()
const { signIn, signOut } = useAuth()
</script>

<template>
  <nav class="navbar glass">
    <div class="navbar-left">
      <button class="menu-btn" @click="emit('toggle-sidebar')" v-if="authStore.isAuthenticated">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <router-link to="/" class="logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--color-accent)">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        <span>Video Helper</span>
      </router-link>
    </div>

    <div class="navbar-right">
      <template v-if="authStore.isAuthenticated">
        <div class="user-info">
          <img
            v-if="authStore.photoURL"
            :src="authStore.photoURL"
            :alt="authStore.displayName"
            class="avatar"
          />
          <span class="user-name">{{ authStore.displayName }}</span>
        </div>
        <button class="btn btn-ghost" @click="signOut">Sign Out</button>
      </template>
      <button v-else class="btn btn-accent" @click="signIn">
        Sign in with Google
      </button>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--navbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-lg);
  z-index: 100;
  border-bottom: 1px solid var(--color-border);
  background: rgba(15, 15, 15, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.menu-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
}

.menu-btn:hover {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: var(--font-size-lg);
}

.logo:hover {
  color: var(--color-text-primary);
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border);
}

.user-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.btn {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  border: none;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-accent {
  background: var(--color-accent);
  color: white;
}

.btn-accent:hover {
  background: var(--color-accent-hover);
  box-shadow: var(--shadow-glow);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

@media (max-width: 768px) {
  .user-name {
    display: none;
  }
}
</style>
