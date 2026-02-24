<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChannel } from '@/composables/useChannel'
import { generateVideoIdeas } from '@/services/groq'
import PageContainer from '@/components/layout/PageContainer.vue'
import ChannelCard from '@/components/channel/ChannelCard.vue'
import VideoCard from '@/components/channel/VideoCard.vue'
import AnalyticsChart from '@/components/channel/AnalyticsChart.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const router = useRouter()
const { channel, videos, topVideos, analysis, loading, error, importChannel, analyze, sortBy } = useChannel()

const channelHandle = ref('')
const sortKey = ref('viewCount')
const filterText = ref('')
const showAnalysis = ref(false)
const selectedVideo = ref(null)
const showVideoModal = ref(false)
const videoIdeas = ref([])
const generatingIdeas = ref(false)
const ideasError = ref('')

// Reset state when modal is closed
watch(showVideoModal, (newVal) => {
  if (!newVal) {
    videoIdeas.value = []
    ideasError.value = ''
  }
})

const filteredVideos = computed(() => {
  if (!filterText.value) return videos.value
  const q = filterText.value.toLowerCase()
  return videos.value.filter(v => v.title.toLowerCase().includes(q))
})

function handleSort(key) {
  sortKey.value = key
  sortBy(key)
}

async function handleImport() {
  if (!channelHandle.value.trim()) return
  await importChannel(channelHandle.value.trim())
  if (channel.value && !error.value && !analysis.value) {
    await analyze()
  }
}

async function handleAnalyze() {
  await analyze()
  showAnalysis.value = true
}

function handleVideoSelect(video) {
  selectedVideo.value = video
  showVideoModal.value = true
}

function watchVideo() {
  if (selectedVideo.value) {
    window.open(`https://www.youtube.com/watch?v=${selectedVideo.value.id}`, '_blank')
    showVideoModal.value = false
  }
}

async function generateIdeas() {
  if (!selectedVideo.value) return

  generatingIdeas.value = true
  ideasError.value = ''
  videoIdeas.value = []

  try {
    const ideas = await generateVideoIdeas(selectedVideo.value, analysis.value)
    videoIdeas.value = ideas
  } catch (err) {
    console.error('Failed to generate video ideas:', err)
    ideasError.value = 'Failed to generate video ideas. Please try again.'
  } finally {
    generatingIdeas.value = false
  }
}

function useIdeaForScript(idea) {
  router.push({
    name: 'ScriptGenerator',
    query: { topic: idea.title }
  })
  showVideoModal.value = false
}

function closeModal() {
  showVideoModal.value = false
}
</script>

<template>
  <PageContainer title="Channel" subtitle="Import and analyze your YouTube channel">
    <!-- Import Button -->
    <div v-if="!channel && !loading" class="import-section">
      <GlassCard :hover="false" padding="lg" class="import-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5">
          <rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="17 2 12 7 7 2" />
        </svg>
        <h2>Look Up a YouTube Channel</h2>
        <p>Enter a channel handle to get AI-powered analytics and personalized script generation.</p>
        <form class="handle-form" @submit.prevent="handleImport">
          <input
            type="text"
            v-model="channelHandle"
            placeholder="@channelhandle"
            class="handle-input"
          />
          <BaseButton size="lg" type="submit" :loading="loading" :disabled="!channelHandle.trim()">
            Import Channel
          </BaseButton>
        </form>
        <p v-if="error" class="error-text">{{ error }}</p>
      </GlassCard>
    </div>

    <!-- Loading -->
    <div v-else-if="loading && !channel" class="loading-state">
      <LoadingSkeleton width="100%" height="200px" />
      <LoadingSkeleton width="100%" height="40px" />
      <div class="skeleton-grid">
        <LoadingSkeleton v-for="i in 6" :key="i" width="100%" height="280px" />
      </div>
    </div>

    <!-- Channel Content -->
    <template v-else-if="channel">
      <ChannelCard :channel="channel" />

      <!-- Analysis Section -->
      <div class="analysis-section">
        <div class="section-header">
          <h3>AI Channel Analysis</h3>
          <BaseButton
            v-if="!analysis"
            size="sm"
            @click="handleAnalyze"
            :loading="loading"
          >
            Analyze Patterns
          </BaseButton>
          <BaseButton
            v-else
            variant="ghost"
            size="sm"
            @click="showAnalysis = !showAnalysis"
          >
            {{ showAnalysis ? 'Hide' : 'Show' }} Analysis
          </BaseButton>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>

        <GlassCard v-if="showAnalysis && analysis" :hover="false" padding="lg" class="analysis-content">
          <div class="analysis-text" v-html="analysis.replace(/\n/g, '<br/>')"></div>
        </GlassCard>
      </div>

      <!-- Analytics Chart -->
      <GlassCard v-if="videos.length" :hover="false" padding="lg" class="chart-section">
        <h3>Video Performance</h3>
        <AnalyticsChart :videos="videos" :metric="sortKey" :height="200" />
      </GlassCard>

      <!-- Videos Section -->
      <div class="videos-section" v-if="videos.length">
        <div class="videos-toolbar">
          <h3>Videos ({{ videos.length }})</h3>
          <div class="toolbar-controls">
            <input
              type="text"
              v-model="filterText"
              placeholder="Filter videos..."
              class="filter-input"
            />
            <div class="sort-buttons">
              <BaseBadge
                v-for="key in ['viewCount', 'likeCount', 'commentCount']"
                :key="key"
                :variant="sortKey === key ? 'accent' : 'default'"
                size="md"
                class="sort-btn"
                @click="handleSort(key)"
              >
                {{ key.replace('Count', 's') }}
              </BaseBadge>
            </div>
          </div>
        </div>

        <div class="video-grid">
          <VideoCard
            v-for="(video, i) in filteredVideos"
            :key="video.id"
            :video="video"
            :rank="sortKey === 'viewCount' && !filterText ? i + 1 : undefined"
            @select="handleVideoSelect"
          />
        </div>
      </div>
    </template>

    <!-- Video Action Modal -->
    <BaseModal v-model="showVideoModal" :title="videoIdeas.length ? 'Video Ideas' : 'What would you like to do?'" max-width="700px">
      <div class="modal-video-info">
        <div class="modal-thumbnail">
          <img :src="selectedVideo?.thumbnail" :alt="selectedVideo?.title" />
        </div>
        <h4 class="modal-video-title">{{ selectedVideo?.title }}</h4>
      </div>

      <!-- Initial Actions -->
      <div v-if="!videoIdeas.length && !generatingIdeas" class="modal-actions">
        <BaseButton size="lg" variant="secondary" @click="watchVideo" block>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Watch Video
        </BaseButton>
        <BaseButton size="lg" @click="generateIdeas" block :loading="generatingIdeas">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Generate Video Ideas
        </BaseButton>
      </div>

      <!-- Loading State -->
      <div v-if="generatingIdeas" class="ideas-loading">
        <LoadingSkeleton width="100%" height="100px" />
        <LoadingSkeleton width="100%" height="100px" />
        <LoadingSkeleton width="100%" height="100px" />
        <p class="loading-text">Generating video ideas...</p>
      </div>

      <!-- Error State -->
      <div v-if="ideasError" class="ideas-error">
        <p class="error-text">{{ ideasError }}</p>
        <BaseButton size="sm" @click="generateIdeas">Try Again</BaseButton>
      </div>

      <!-- Generated Ideas -->
      <div v-if="videoIdeas.length" class="ideas-list">
        <div v-for="(idea, index) in videoIdeas" :key="index" class="idea-card">
          <div class="idea-header">
            <h5 class="idea-title">{{ idea.title }}</h5>
            <BaseBadge variant="accent" size="sm">{{ idea.estimatedPerformance || '100%' }}</BaseBadge>
          </div>
          <p class="idea-description">{{ idea.description }}</p>
          <div class="idea-hook">
            <strong>Hook:</strong> {{ idea.hookSuggestion }}
          </div>
          <p class="idea-reasoning">{{ idea.reasoning }}</p>
          <BaseButton size="sm" @click="useIdeaForScript(idea)" block>
            Use for Script
          </BaseButton>
        </div>
        <div class="ideas-actions">
          <BaseButton variant="ghost" @click="closeModal">Close</BaseButton>
          <BaseButton variant="secondary" @click="generateIdeas" :loading="generatingIdeas">
            Generate More Ideas
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </PageContainer>
</template>

<style scoped>
.import-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-3xl);
}

.import-card {
  text-align: center;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.import-card h2 {
  font-size: var(--font-size-xl);
}

.import-card p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.handle-form {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
  max-width: 400px;
}

.handle-input {
  flex: 1;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-fast);
}

.handle-input:focus {
  border-color: var(--color-accent);
}

.handle-input::placeholder {
  color: var(--color-text-muted);
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-top: var(--space-md);
}

.analysis-section {
  margin-top: var(--space-xl);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-header h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.analysis-content {
  margin-bottom: var(--space-lg);
}

.analysis-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.chart-section {
  margin-top: var(--space-xl);
}

.chart-section h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.videos-section {
  margin-top: var(--space-xl);
}

.videos-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.videos-toolbar h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.toolbar-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.filter-input {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  outline: none;
  width: 200px;
  transition: border-color var(--transition-fast);
}

.filter-input:focus {
  border-color: var(--color-accent);
}

.filter-input::placeholder {
  color: var(--color-text-muted);
}

.sort-buttons {
  display: flex;
  gap: var(--space-xs);
}

.sort-btn {
  cursor: pointer;
  transition: all var(--transition-fast);
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (max-width: 768px) {
  .video-grid {
    grid-template-columns: 1fr;
  }
  .skeleton-grid {
    grid-template-columns: 1fr;
  }
}

.modal-video-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.modal-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.modal-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-video-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ideas-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md) 0;
}

.loading-text {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-top: var(--space-sm);
}

.ideas-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
  text-align: center;
}

.ideas-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-height: 500px;
  overflow-y: auto;
  padding-right: var(--space-xs);
}

.idea-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  transition: all var(--transition-base);
}

.idea-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-sm);
}

.idea-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-sm);
}

.idea-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0;
  flex: 1;
}

.idea-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0;
}

.idea-hook {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
}

.idea-hook strong {
  color: var(--color-accent);
  margin-right: var(--space-xs);
}

.idea-reasoning {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0;
}

.ideas-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-md);
  position: sticky;
  bottom: 0;
  background: var(--color-bg-primary);
}
</style>
