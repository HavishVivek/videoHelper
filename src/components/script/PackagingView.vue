<script setup>
import { ref, computed } from 'vue'
import { useScriptsStore } from '@/stores/scripts'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const props = defineProps({
  script: {
    type: Object,
    required: true
  }
})

const store = useScriptsStore()
const loading = ref(false)
const loadingThumb = ref(false)
const thumbnailError = ref('')
const generatingTitle = ref(false)
const generatedTitle = ref('')

const hasPackaging = computed(() => {
  return (props.script.thumbnailUrl) || 
         (props.script.metadata && props.script.metadata.titles)
})

async function generateAll() {
  loading.value = true
  await store.fetchMetadata(props.script.id)
  loading.value = false
}

async function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  
  // Validation: Max 1MB
  if (file.size > 1024 * 1024) {
    thumbnailError.value = 'File too large (Max 1MB)'
    return
  }
  
  loadingThumb.value = true
  thumbnailError.value = ''
  
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result
      await store.updateScript(props.script.id, { thumbnailUrl: base64 })
      window.__toast?.('Thumbnail uploaded', 'success')
      loadingThumb.value = false
    }
    reader.onerror = () => {
      thumbnailError.value = 'Failed to read file'
      loadingThumb.value = false
    }
    reader.readAsDataURL(file)
  } catch (e) {
    thumbnailError.value = 'Upload failed'
    loadingThumb.value = false
  }
}

async function generateTitleForThumbnail() {
  generatingTitle.value = true
  
  // Simulate AI analysis delay
  setTimeout(() => {
    // Generate a contextual title based on topic
    const templates = [
      `The Truth About ${props.script.topic}`,
      `Why ${props.script.topic} Changes Everything`,
      `Stop doing ${props.script.topic} wrong!`,
      `${props.script.topic} Explained in 5 Minutes`,
      `The Ultimate Guide to ${props.script.topic}`
    ]
    generatedTitle.value = templates[Math.floor(Math.random() * templates.length)]
    generatingTitle.value = false
  }, 1500)
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
        <h3 class="section-title">Thumbnail Image</h3>
        <GlassCard padding="lg" :hover="false">
          <div class="thumbnail-updater">
            <div class="input-group file-input-group">
              <label class="file-upload-btn">
                <input type="file" accept="image/*" @change="handleFileUpload" class="hidden-input" />
                <span v-if="loadingThumb">Uploading...</span>
                <span v-else>Start Upload from Computer</span>
              </label>
              <div v-if="thumbnailError" class="error-text">{{ thumbnailError }}</div>
            </div>
            
            <div v-if="script.thumbnailUrl" class="thumb-preview-container">
              <div class="preview-header">
                <h4>Current Thumbnail</h4>
                <BaseButton 
                  size="sm" 
                  variant="accent" 
                  @click="generateTitleForThumbnail"
                  :loading="generatingTitle"
                >
                  Generate Title for this
                </BaseButton>
              </div>
              <img :src="script.thumbnailUrl" alt="Thumbnail Preview" class="thumb-preview-img" />
              
              <div v-if="generatedTitle" class="generated-title-box">
                <label>Suggested Title:</label>
                <div class="title-content">
                  {{ generatedTitle }}
                  <button class="copy-btn" @click="copyToClipboard(generatedTitle)">Copy</button>
                </div>
              </div>
            </div>
            <div v-else class="empty-thumb-placeholder">
              <p>No thumbnail attached. Upload an image to add one.</p>
            </div>
          </div>
        </GlassCard>
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

/* Thumbnail Manual Input */
.file-input-group {
  flex-direction: column;
  align-items: stretch;
}

.file-upload-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-xl);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: var(--color-bg-input);
  transition: all 0.2s;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.file-upload-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.05);
}

.hidden-input {
  display: none;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin-top: var(--space-xs);
  text-align: center;
}

.thumb-preview-container {
  margin-top: var(--space-lg);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.thumb-preview-container h4 {
  margin-bottom: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.thumb-preview-img {
  width: 100%;
  max-width: 480px;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.generated-title-box {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.generated-title-box label {
  display: block;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.title-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-thumb-placeholder {
  padding: var(--space-xl);
  text-align: center;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.actions-footer {
  display: flex;
  justify-content: center;
  padding-top: var(--space-lg);
}
</style>
