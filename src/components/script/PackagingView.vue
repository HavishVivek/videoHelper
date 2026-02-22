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
const loadingThumb = ref([false, false, false])
const thumbnailError = ref(['', '', ''])
const generatingTitles = ref(false)

// Initialize thumbnails array if it doesn't exist
const thumbnails = computed(() => {
  const thumbs = props.script.thumbnails || []
  // Ensure we always have 3 slots
  while (thumbs.length < 3) {
    thumbs.push({ url: null, title: null })
  }
  return thumbs.slice(0, 3) // Max 3 thumbnails
})

const hasPackaging = computed(() => {
  const hasThumbnails = props.script.thumbnails?.some(t => t.url)
  return hasThumbnails || (props.script.metadata && props.script.metadata.titles)
})

async function generateAll() {
  loading.value = true
  await store.fetchMetadata(props.script.id)
  loading.value = false
}

async function handleFileUpload(event, index) {
  const file = event.target.files[0]
  if (!file) return

  // Validation: Max 1MB
  if (file.size > 1024 * 1024) {
    thumbnailError.value[index] = 'File too large (Max 1MB)'
    return
  }

  loadingThumb.value[index] = true
  thumbnailError.value[index] = ''

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result
      const updatedThumbnails = [...thumbnails.value]
      updatedThumbnails[index] = { ...updatedThumbnails[index], url: base64 }

      await store.updateScript(props.script.id, { thumbnails: updatedThumbnails })
      window.__toast?.('Thumbnail uploaded', 'success')
      loadingThumb.value[index] = false
    }
    reader.onerror = () => {
      thumbnailError.value[index] = 'Failed to read file'
      loadingThumb.value[index] = false
    }
    reader.readAsDataURL(file)
  } catch (e) {
    thumbnailError.value[index] = 'Upload failed'
    loadingThumb.value[index] = false
  }
}

async function removeThumbnail(index) {
  const updatedThumbnails = [...thumbnails.value]
  updatedThumbnails[index] = { url: null, title: null }
  await store.updateScript(props.script.id, { thumbnails: updatedThumbnails })
  window.__toast?.('Thumbnail removed', 'success')
}

async function generateTitlesForThumbnails() {
  generatingTitles.value = true

  try {
    const titles = await store.fetchThumbnailTitles(props.script.id)

    if (titles && titles.length === 3) {
      const updatedThumbnails = thumbnails.value.map((thumb, i) => ({
        ...thumb,
        title: titles[i]
      }))
      await store.updateScript(props.script.id, { thumbnails: updatedThumbnails })
      window.__toast?.('Titles generated successfully', 'success')
    }
  } catch (e) {
    window.__toast?.('Failed to generate titles', 'error')
    console.error('Title generation error:', e)
  } finally {
    generatingTitles.value = false
  }
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
        <div class="section-header">
          <h3 class="section-title">Thumbnail Images (Max 3)</h3>
          <BaseButton
            v-if="thumbnails.some(t => t.url)"
            size="sm"
            variant="accent"
            @click="generateTitlesForThumbnails"
            :loading="generatingTitles"
          >
            Generate Titles for All
          </BaseButton>
        </div>

        <div class="thumbnails-grid">
          <GlassCard
            v-for="(thumbnail, index) in thumbnails"
            :key="index"
            padding="md"
            :hover="false"
            class="thumbnail-card"
          >
            <div class="thumbnail-slot">
              <div class="slot-header">
                <span class="slot-number">Thumbnail {{ index + 1 }}</span>
                <button
                  v-if="thumbnail.url"
                  class="remove-btn"
                  @click="removeThumbnail(index)"
                  title="Remove thumbnail"
                >
                  ✕
                </button>
              </div>

              <div v-if="!thumbnail.url" class="upload-area">
                <label class="file-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    @change="(e) => handleFileUpload(e, index)"
                    class="hidden-input"
                  />
                  <span v-if="loadingThumb[index]">Uploading...</span>
                  <span v-else>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Upload Image
                  </span>
                </label>
                <div v-if="thumbnailError[index]" class="error-text">
                  {{ thumbnailError[index] }}
                </div>
              </div>

              <div v-else class="thumbnail-preview">
                <img :src="thumbnail.url" alt="Thumbnail Preview" class="preview-img" />

                <div v-if="thumbnail.title" class="thumbnail-title-box">
                  <label>AI-Generated Title:</label>
                  <div class="title-content">
                    <span>{{ thumbnail.title }}</span>
                    <button class="copy-btn" @click="copyToClipboard(thumbnail.title)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                </div>
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: 0;
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

/* Thumbnails Grid */
.thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

.thumbnail-card {
  min-height: 350px;
}

.thumbnail-slot {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.slot-number {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.remove-btn {
  background: rgba(255, 59, 48, 0.1);
  border: none;
  color: #ff3b30;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(255, 59, 48, 0.2);
}

.upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.file-upload-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: var(--color-bg-input);
  transition: all 0.2s;
  color: var(--color-text-secondary);
  font-weight: 500;
  min-height: 200px;
}

.file-upload-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.05);
}

.file-upload-btn svg {
  opacity: 0.5;
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

.thumbnail-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.preview-img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.thumbnail-title-box {
  padding: var(--space-sm);
  background: var(--color-bg-input);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.thumbnail-title-box label {
  display: block;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.title-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 500;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.title-content span {
  flex: 1;
}

.actions-footer {
  display: flex;
  justify-content: center;
  padding-top: var(--space-lg);
}
</style>
