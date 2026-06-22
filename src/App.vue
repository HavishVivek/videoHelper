<script setup>
import { ref } from 'vue'
import Navbar from '@/components/layout/Navbar.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const sidebarOpen = ref(true)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}
</script>

<template>
  <div class="app" :class="{ 'sidebar-open': sidebarOpen && authStore.isAuthenticated }">
    <Navbar @toggle-sidebar="toggleSidebar" />

    <Sidebar v-if="authStore.isAuthenticated" :open="sidebarOpen" />

    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition name="page" mode="out-in">
          <div class="route-shell" :key="route.fullPath">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>

    <ToastContainer />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: var(--space-xl);
  padding-top: calc(var(--navbar-height) + var(--space-xl));
  transition: margin-left var(--transition-base);
  max-width: 100%;
}

.sidebar-open .main-content {
  margin-left: var(--sidebar-width);
}

@media (max-width: 768px) {
  .main-content {
    padding: var(--space-md);
    padding-top: calc(var(--navbar-height) + var(--space-md));
  }

  .sidebar-open .main-content {
    margin-left: 0;
  }
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
