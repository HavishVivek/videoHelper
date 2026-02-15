<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScripts } from '@/composables/useScripts'
import { useGroq } from '@/composables/useGroq'
import { useChannelStore } from '@/stores/channel'
import PageContainer from '@/components/layout/PageContainer.vue'
import GlassCard from '@/components/ui/GlassCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import MetricGauge from '@/components/ui/MetricGauge.vue'
import PredictionCard from '@/components/dashboard/PredictionCard.vue'
import ComparisonChart from '@/components/dashboard/ComparisonChart.vue'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton.vue'

const route = useRoute()
const router = useRouter()
const { load } = useScripts()
const { getPrediction } = useGroq()
const channelStore = useChannelStore()

const script = ref(null)
const prediction = ref(null)
const loading = ref(true)
const generating = ref(false)

onMounted(async () => {
  const id = route.params.id
  script.value = await load(id)

  if (script.value?.prediction) {
    prediction.value = script.value.prediction
  }

  loading.value = false
})

async function generatePrediction() {
  if (!script.value) return
  generating.value = true
  prediction.value = await getPrediction(script.value.content)
  generating.value = false
}

function goToEditor() {
  router.push(`/editor/${route.params.id}`)
}
</script>

<template>
  <PageContainer
    title="Performance Predictions"
    subtitle="AI-powered performance analysis for your script"
  >
    <template #actions>
      <BaseButton variant="ghost" size="sm" @click="goToEditor">Back to Editor</BaseButton>
    </template>

    <div v-if="loading" class="loading-state">
      <LoadingSkeleton width="100%" height="300px" />
      <div class="skeleton-row">
        <LoadingSkeleton width="100%" height="150px" />
        <LoadingSkeleton width="100%" height="150px" />
        <LoadingSkeleton width="100%" height="150px" />
      </div>
    </div>

    <template v-else-if="script">
      <!-- No channel warning -->
      <GlassCard v-if="!channelStore.channel" :hover="false" padding="md" class="warning-card">
        <p>Connect your YouTube channel for more accurate predictions based on your actual performance data.</p>
        <BaseButton variant="secondary" size="sm" @click="router.push('/channel')">Connect Channel</BaseButton>
      </GlassCard>

      <!-- Generate button if no prediction yet -->
      <div v-if="!prediction && !generating" class="generate-section">
        <GlassCard :hover="false" padding="lg" class="generate-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h2>Generate Performance Prediction</h2>
          <p>Analyze your script to predict retention, engagement, and audience response.</p>
          <BaseButton size="lg" @click="generatePrediction">Analyze Script</BaseButton>
        </GlassCard>
      </div>

      <!-- Loading prediction -->
      <div v-else-if="generating" class="loading-state">
        <GlassCard :hover="false" padding="lg" class="generating-card">
          <div class="generating-spinner" />
          <h3>Analyzing your script...</h3>
          <p>Comparing against channel patterns and generating predictions.</p>
        </GlassCard>
      </div>

      <!-- Prediction Results -->
      <template v-else-if="prediction">
        <!-- Metric Gauges -->
        <div class="gauges-row">
          <GlassCard :hover="false" padding="lg" class="gauge-card">
            <MetricGauge
              :value="prediction.retentionPercent || 0"
              :max="100"
              label="Retention"
              :size="130"
            />
          </GlassCard>
          <GlassCard :hover="false" padding="lg" class="gauge-card">
            <MetricGauge
              :value="(prediction.engagementScore || 0) * 10"
              :max="100"
              label="Engagement"
              :size="130"
              color="var(--color-info)"
            />
          </GlassCard>
          <GlassCard :hover="false" padding="lg" class="gauge-card">
            <MetricGauge
              :value="Math.min(100, (prediction.retentionPercent || 50) * 1.1)"
              :max="100"
              label="CTR Potential"
              :size="130"
              color="var(--color-warning)"
            />
          </GlassCard>
        </div>

        <!-- Retention Chart -->
        <ComparisonChart
          :retention-curve="prediction.retentionCurve || []"
          class="comparison-chart"
        />

        <!-- Prediction Details -->
        <PredictionCard :prediction="prediction" class="prediction-details" />

        <!-- Regenerate -->
        <div class="regenerate-section">
          <BaseButton variant="secondary" @click="generatePrediction" :loading="generating">
            Regenerate Prediction
          </BaseButton>
          <BaseButton variant="ghost" @click="goToEditor">
            Edit Script
          </BaseButton>
        </div>
      </template>
    </template>

    <div v-else class="not-found">
      <GlassCard :hover="false" padding="lg">
        <h2>Script Not Found</h2>
        <p>This script doesn't exist or you don't have access.</p>
        <BaseButton @click="router.push('/generate')">Generate New Script</BaseButton>
      </GlassCard>
    </div>
  </PageContainer>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.skeleton-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}

.warning-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  background: rgba(255, 152, 0, 0.05);
  border-color: rgba(255, 152, 0, 0.2);
}

.warning-card p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.generate-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-2xl);
}

.generate-card {
  text-align: center;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.generate-card h2 {
  font-size: var(--font-size-xl);
}

.generate-card p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.generating-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.generating-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.generating-card h3 {
  font-size: var(--font-size-lg);
}

.generating-card p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.gauges-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.gauge-card {
  display: flex;
  justify-content: center;
  align-items: center;
}

.comparison-chart {
  margin-bottom: var(--space-lg);
}

.prediction-details {
  margin-bottom: var(--space-lg);
}

.regenerate-section {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
}

.not-found {
  display: flex;
  justify-content: center;
  padding-top: var(--space-3xl);
  text-align: center;
}

.not-found h2 {
  margin-bottom: var(--space-sm);
}

.not-found p {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-lg);
}

@media (max-width: 768px) {
  .gauges-row,
  .skeleton-row {
    grid-template-columns: 1fr;
  }
}
</style>
