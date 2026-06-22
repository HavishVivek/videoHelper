import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import VueFeather from 'vue-feather'
import './assets/styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Register Feather icons globally
app.component('vue-feather', VueFeather)

// Initialize auth state before mounting
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.initAuth().then(() => {
  app.mount('#app')
  app.config.errorHandler = (err, instance, info) => {
    console.error('Vue error:', err, info)
  }
})