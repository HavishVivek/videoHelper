<script setup>
import { formatNumber } from '@/utils/formatters'
import GlassCard from '@/components/ui/GlassCard.vue'

defineProps({
  channel: { type: Object, required: true }
})
</script>

<template>
  <GlassCard class="channel-card" :hover="false">
    <div class="channel-header">
      <img :src="channel.thumbnail" :alt="channel.title" class="channel-avatar" />
      <div class="channel-info">
        <h2 class="channel-name">{{ channel.title }}</h2>
        <p class="channel-description">{{ channel.description?.slice(0, 120) }}</p>
      </div>
    </div>
    <div class="channel-stats">
      <div class="stat">
        <span class="stat-value">{{ formatNumber(channel.subscriberCount) }}</span>
        <span class="stat-label">Subscribers</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ formatNumber(channel.viewCount) }}</span>
        <span class="stat-label">Total Views</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ formatNumber(channel.videoCount) }}</span>
        <span class="stat-label">Videos</span>
      </div>
    </div>
  </GlassCard>
</template>

<style scoped>
.channel-card {
  padding: var(--space-xl);
}

.channel-header {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.channel-avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  border: 3px solid var(--color-accent);
}

.channel-name {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.channel-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.channel-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}

.stat {
  text-align: center;
  padding: var(--space-md);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
}

.stat-value {
  display: block;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--space-xs);
}
</style>
