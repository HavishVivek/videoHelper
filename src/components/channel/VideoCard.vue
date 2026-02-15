<script setup>
import { computed } from 'vue'
import { formatNumber, timeAgo, engagementRate } from '@/utils/formatters'
import { parseDuration, formatDuration } from '@/services/youtube'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const props = defineProps({
  video: { type: Object, required: true },
  rank: Number
})

const engagement = computed(() => engagementRate(props.video.likeCount, props.video.viewCount))
const durationFormatted = computed(() => {
  if (!props.video.duration) return ''
  return formatDuration(parseDuration(props.video.duration))
})
</script>

<template>
  <div class="video-card glass">
    <div class="thumbnail-wrapper">
      <img :src="video.thumbnail" :alt="video.title" class="thumbnail" />
      <span class="duration" v-if="durationFormatted">{{ durationFormatted }}</span>
      <span class="rank" v-if="rank">{{ rank }}</span>
    </div>
    <div class="video-info">
      <h3 class="video-title">{{ video.title }}</h3>
      <div class="video-meta">
        <span>{{ formatNumber(video.viewCount) }} views</span>
        <span>{{ timeAgo(video.publishedAt) }}</span>
      </div>
      <div class="video-stats">
        <BaseBadge variant="success" size="sm">{{ engagement }}% engagement</BaseBadge>
        <BaseBadge size="sm">{{ formatNumber(video.likeCount) }} likes</BaseBadge>
        <BaseBadge size="sm">{{ formatNumber(video.commentCount) }} comments</BaseBadge>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.video-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-border-hover);
}

.thumbnail-wrapper {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.rank {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.video-info {
  padding: var(--space-md);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.video-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-meta {
  display: flex;
  gap: var(--space-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.video-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: auto;
}
</style>
