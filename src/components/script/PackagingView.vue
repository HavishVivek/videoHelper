<script setup>
import { ref, computed } from 'vue'
import { useScriptsStore } from '@/stores/scripts'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const props = defineProps({
  script: {
    type: Object,
    required: true
  }
})

const store = useScriptsStore()
const loading = ref(false)

const hasPackaging = computed(() => {
  return (props.script.thumbnails && props.script.thumbnails.length > 0) || 
         (props.script.metadata && props.script.metadata.titles)
})

async function generateAll() {
  loading.value = true
  await Promise.all([
    store.fetchThumbnails(props.script.id),
    store.fetchMetadata(props.script.id)
  ])
  loading.value = false
}

function getThumbnailUrl(thumb) {
  // Keep prompt concise to avoid URL issues
  const desc = thumb.description.length > 80 ? thumb.description.substring(0, 80) + '...' : thumb.description
  const text = thumb.textOverlay.replace(/[^\w\s]/g, '') // Remove special chars form text
  const prompt = `YouTube thumbnail, ${desc}, text "${text}" big bold font, ${thumb.colorMood} style, 4k`
  
  // Use a simple random seed based on description length to keep it consistent but unique per card
  const seed = thumb.description.length + thumb.textOverlay.length
  
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&model=flux&nologo=true&seed=${seed}`
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
  window.__toast?.('Copied to clipboard', 'success')
}
</script>

<template>
  <div class="packaging-view animate-fade-in">
    <div v-if="!hasPackaging && !loading" class="empty-state">
      <GlassCard padding="lg" :hover="false">
        <h3>Generate Packaging</h3>
        <p>Create AI-powered titles, thumbnails, and SEO metadata for your video.</p>
        <BaseButton size="lg" @click="generateAll">Generate Concepts</BaseButton>
      </GlassCard>
    </div>

    <div v-else-if="loading" class="loading-state">
      <GlassCard padding="lg" :hover="false">
        <div class="spinner"></div>
        <p>Generating viral concepts...</p>
      </GlassCard>
    </div>

    <div v-else class="packaging-grid">
      <!-- Titles & SEO -->
      <section class="packaging-section">
        <h3 class="section-title">Titles & SEO</h3>
        <GlassCard v-if="script.metadata" padding="md" :hover="false">
          <div class="titles-list">
            <div v-for="(title, i) in script.metadata.titles" :key="i" class="title-item">
              <span class="title-text">{{ title }}</span>
              <button class="copy-btn" @click="copyToClipboard(title)" title="Copy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="meta-block">
            <label>Description</label>
            <div class="desc-box">
              {{ script.metadata.description }}
              <button class="copy-btn absolute" @click="copyToClipboard(script.metadata.description)">
                Copy
              </button>
            </div>
          </div>

          <div class="meta-block">
            <label>Tags</label>
            <div class="tags-cloud">
              <span v-for="tag in script.metadata.tags" :key="tag" class="tag">{{ tag }}</span>
              <button class="copy-tags-btn" @click="copyToClipboard(script.metadata.tags.join(', '))">
                Copy All
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      <!-- Thumbnails -->
      <section class="packaging-section">
        <h3 class="section-title">Thumbnail Concepts</h3>
        <div class="thumbnails-grid">
          <GlassCard 
            v-for="(thumb, i) in script.thumbnails" 
            :key="i" 
            padding="none" 
            :hover="true"
            class="thumb-card"
          >
            <div class="thumb-image-container">
              <img 
                :src="getThumbnailUrl(thumb)" 
                alt="AI Generated Thumbnail" 
                class="thumb-image"
                loading="lazy"
              />
            </div>
            
            <div class="thumb-content-wrapper">
              <div class="thumb-header">
                <BaseBadge variant="accent">Concept {{ i + 1 }}</BaseBadge>
                <span class="thumb-psych">{{ thumb.psychology }}</span>
              </div>
              
              <div class="thumb-content">
                <h4>Visual</h4>
                <p>{{ thumb.description }}</p>
                
                <h4>Text Overlay</h4>
                <div class="overlay-box">{{ thumb.textOverlay }}</div>
                
                <h4>Mood</h4>
                <p class="mood-text">{{ thumb.colorMood }}</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
      
      <div class="actions-footer">
        <BaseButton variant="secondary" @click="generateAll" :loading="loading">
          Regenerate
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.packaging-view {
  width: 100%;
}

.empty-state, .loading-state {
  text-align: center;
  max-width: 500px;
  margin: var(--space-2xl) auto;
}

.loading-state .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(var(--color-accent-rgb), 0.3);
  border-radius: 50%;
  border-top-color: var(--color-accent);
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto var(--space-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.packaging-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text-primary);
}

.titles-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.title-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm);
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
  gap: var(--space-sm);
}

.title-text {
  font-weight: 500;
  color: var(--color-text-primary);
}

.copy-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.copy-btn:hover {
  color: var(--color-accent);
  background: var(--color-bg-hover);
}

.meta-block {
  margin-top: var(--space-lg);
}

.meta-block label {
  display: block;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: var(--space-xs);
  letter-spacing: 0.05em;
}

.desc-box {
  position: relative;
  padding: var(--space-md);
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  white-space: pre-wrap;
}

.desc-box .absolute {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  text-transform: uppercase;
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
}

.tag {
  background: var(--color-bg-input);
  color: var(--color-text-secondary);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
}

.copy-tags-btn {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  background: none;
  border: none;
  cursor: pointer;
  margin-left: var(--space-xs);
}

/* Thumbnails */
.thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

.thumb-card {
  height: 100%;
}

.thumb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.thumb-psych {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.thumb-image-container {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--color-bg-input);
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}

.thumb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.thumb-card:hover .thumb-image {
  transform: scale(1.05);
}

.thumb-content-wrapper {
  padding: var(--space-md);
}

.thumb-content h4 {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  margin-top: var(--space-md);
}

.thumb-content h4:first-child {
  margin-top: 0;
}

.overlay-box {
  background: var(--color-error);
  color: white;
  padding: 8px;
  font-weight: 800;
  text-transform: uppercase;
  display: inline-block;
  transform: rotate(-2deg);
  font-size: var(--font-size-lg);
  margin: var(--space-xs) 0;
}

.mood-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.actions-footer {
  display: flex;
  justify-content: center;
  padding-top: var(--space-lg);
}
</style>
