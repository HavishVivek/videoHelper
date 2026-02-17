import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue')
  },
  {
    path: '/channel',
    name: 'Channel',
    component: () => import('@/views/ChannelView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/generate',
    name: 'ScriptGenerator',
    component: () => import('@/views/ScriptGeneratorView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/import',
    name: 'ImportScript',
    component: () => import('@/views/ImportScriptView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/editor/:id',
    name: 'Editor',
    component: () => import('@/views/EditorView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/predictions/:id',
    name: 'Predictions',
    component: () => import('@/views/PredictionsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ideas',
    name: 'Ideas',
    component: () => import('@/views/IdeasView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/calendar',
    name: 'Calendar',
    component: () => import('@/views/CalendarView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
