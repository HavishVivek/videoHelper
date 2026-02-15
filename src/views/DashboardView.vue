<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChannelStore } from '@/stores/channel'
import { useScriptsStore } from '@/stores/scripts'
import { useAuth } from '@/composables/useAuth'
import { formatNumber } from '@/utils/formatters'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import MetricGauge from '@/components/ui/MetricGauge.vue'
import AnalyticsChart from '@/components/channel/AnalyticsChart.vue'

const router = useRouter()
const authStore = useAuthStore()
const channelStore = useChannelStore()
const scriptsStore = useScriptsStore()
const { signIn } = useAuth()

const recentScripts = computed(() => scriptsStore.sortedScripts.slice(0, 3))
const avgEngagement = computed(() => {
  if (!channelStore.videos.length) return 0
  const total = channelStore.videos.reduce((sum, v) => {
    return sum + (v.viewCount ? (v.likeCount / v.viewCount) * 100 : 0)
  }, 0)
  return (total / channelStore.videos.length).toFixed(1)
})

onMounted(async () => {
  if (authStore.isAuthenticated) {
    if (!channelStore.channel) {
      await channelStore.loadCachedChannel(authStore.user.uid)
    }
    await scriptsStore.loadScripts()
  }
})
</script>

<template>
  <PageContainer>
    <!-- Unauthenticated Landing -->
    <div v-if="!authStore.isAuthenticated" class="landing">
      <div class="hero">
        <h1 class="hero-title">
          Your AI-Powered<br />
          <span class="accent">YouTube Assistant</span>
        </h1>
        <p class="hero-subtitle">
          Analyze your channel, generate scripts with AI, and predict video performance
          — all in one place.
        </p>
        <BaseButton size="lg" @click="signIn">
          Get Started with Google
        </BaseButton>
      </div>

      <div class="features-grid">
        <GlassCard>
          <div class="feature-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2">
              <rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="17 2 12 7 7 2" />
            </svg>
          </div>
          <h3>Channel Analytics</h3>
          <p>Import your YouTube channel and get AI-powered insights about your content patterns.</p>
        </GlassCard>

        <GlassCard>
          <div class="feature-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h3>AI Script Generation</h3>
          <p>Generate engaging video scripts with multiple intro variations tailored to your style.</p>
        </GlassCard>

        <GlassCard>
          <div class="feature-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h3>Performance Prediction</h3>
          <p>Get AI predictions for retention, engagement, and audience response before publishing.</p>
        </GlassCard>
      </div>
    </div>

    <!-- Authenticated Dashboard -->
    <template v-else>
      <h1 class="dashboard-title">Dashboard</h1>

      <div class="dashboard-grid">
        <!-- Quick Stats -->
        <div class="stats-row">
          <GlassCard class="stat-card">
            <span class="stat-label">Total Views</span>
            <span class="stat-value">{{ formatNumber(channelStore.totalViews) }}</span>
          </GlassCard>
          <GlassCard class="stat-card">
            <span class="stat-label">Videos</span>
            <span class="stat-value">{{ channelStore.videos.length }}</span>
          </GlassCard>
          <GlassCard class="stat-card">
            <span class="stat-label">Avg Views</span>
            <span class="stat-value">{{ formatNumber(channelStore.averageViews) }}</span>
          </GlassCard>
          <GlassCard class="stat-card">
            <span class="stat-label">Scripts</span>
            <span class="stat-value">{{ scriptsStore.scripts.length }}</span>
          </GlassCard>
        </div>

        <!-- Charts Row -->
        <div class="charts-row" v-if="channelStore.videos.length">
          <GlassCard :hover="false" padding="lg">
            <h3 class="section-title">Views Over Time</h3>
            <AnalyticsChart :videos="channelStore.videos" metric="viewCount" :height="180" />
          </GlassCard>

          <GlassCard :hover="false" padding="lg" class="engagement-card">
            <h3 class="section-title">Engagement</h3>
            <div class="gauge-center">
              <MetricGauge :value="parseFloat(avgEngagement)" :max="10" label="Avg %" :size="140" />
            </div>
          </GlassCard>
        </div>

        <!-- No channel prompt -->
        <GlassCard v-if="!channelStore.channel" :hover="false" padding="lg" class="empty-state">
          <h3>Import Your Channel</h3>
          <p>Connect your YouTube channel to get started with analytics and AI-powered scripts.</p>
          <BaseButton @click="router.push('/channel')">Import Channel</BaseButton>
        </GlassCard>

        <!-- Recent Scripts -->
        <GlassCard v-if="recentScripts.length" :hover="false" padding="lg">
          <div class="section-header">
            <h3 class="section-title">Recent Scripts</h3>
            <BaseButton variant="ghost" size="sm" @click="router.push('/generate')">View All</BaseButton>
          </div>
          <div class="scripts-list">
            <div
              v-for="script in recentScripts"
              :key="script.id"
              class="script-item glass"
              @click="router.push(`/editor/${script.id}`)"
            >
              <span class="script-topic">{{ script.topic || 'Untitled' }}</span>
              <span class="script-date">{{ new Date(script.updatedAt).toLocaleDateString() }}</span>
            </div>
          </div>
        </GlassCard>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <BaseButton size="lg" @click="router.push('/generate')">
            Generate New Script
          </BaseButton>
          <BaseButton variant="outline" size="lg" @click="router.push('/import')">
            Analyze Existing Script
          </BaseButton>
          <BaseButton variant="secondary" size="lg" @click="router.push('/channel')">
            View Channel
          </BaseButton>
        </div>
      </div>
    </template>
  </PageContainer>
</template>

<style scoped>
/* Landing */
.landing {
  text-align: center;
  padding-top: var(--space-3xl);
}

.hero {
  margin-bottom: var(--space-3xl);
}

.hero-title {
  font-size: var(--font-size-4xl);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: var(--space-lg);
  letter-spacing: -0.03em;
}

.accent {
  color: var(--color-accent);
}

.hero-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  max-width: 600px;
  margin: 0 auto var(--space-xl);
  line-height: 1.6;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-lg);
  text-align: left;
}

.feature-icon {
  margin-bottom: var(--space-md);
}

.features-grid h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-sm);
}

.features-grid p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* Dashboard */
.dashboard-title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin-bottom: var(--space-xl);
  letter-spacing: -0.02em;
}

.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.stat-card {
  text-align: center;
  padding: var(--space-lg);
}

.stat-label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-xs);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
}

.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-lg);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.gauge-center {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-lg) 0;
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
}

.empty-state h3 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-sm);
}

.empty-state p {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-lg);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.scripts-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.script-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.script-item:hover {
  background: var(--color-bg-card-hover);
}

.script-topic {
  font-weight: 500;
}

.script-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.quick-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: var(--font-size-3xl);
  }
}
</style>
