<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  videos: { type: Array, default: () => [] },
  metric: { type: String, default: 'viewCount' },
  height: { type: Number, default: 200 }
})

const canvas = ref(null)

const sortedVideos = computed(() => {
  return [...props.videos]
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt))
    .slice(-20)
})

function draw() {
  const el = canvas.value
  if (!el || !sortedVideos.value.length) return

  const ctx = el.getContext('2d')
  const w = el.width = el.offsetWidth * 2
  const h = el.height = props.height * 2
  ctx.scale(2, 2)

  const width = el.offsetWidth
  const height = props.height
  const padding = { top: 10, right: 10, bottom: 10, left: 50 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  ctx.clearRect(0, 0, width, height)

  const values = sortedVideos.value.map(v => v[props.metric] || 0)
  const maxVal = Math.max(...values) * 1.1
  const barWidth = Math.max(4, (plotW / values.length) - 4)

  values.forEach((v, i) => {
    const x = padding.left + (plotW / values.length) * i + 2
    const barH = (v / maxVal) * plotH
    const y = padding.top + plotH - barH

    const gradient = ctx.createLinearGradient(x, y, x, y + barH)
    gradient.addColorStop(0, 'rgba(255, 68, 68, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 68, 68, 0.2)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barH, 3)
    ctx.fill()
  })

  // Y-axis labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.font = '10px Inter, sans-serif'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 3; i++) {
    const val = Math.round((maxVal / 3) * i)
    const y = padding.top + plotH - (plotH / 3) * i
    const label = val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` :
                  val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val
    ctx.fillText(label, padding.left - 8, y + 3)
  }
}

watch(() => [props.videos, props.metric], draw)
onMounted(() => setTimeout(draw, 100))
</script>

<template>
  <div class="analytics-chart">
    <canvas ref="canvas" :style="{ height: `${height}px`, width: '100%' }" />
  </div>
</template>

<style scoped>
.analytics-chart {
  width: 100%;
}

canvas {
  display: block;
}
</style>
