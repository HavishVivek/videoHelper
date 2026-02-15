<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  comparisonData: { type: Array, default: () => [] },
  height: { type: Number, default: 200 },
  label: { type: String, default: 'Retention' },
  comparisonLabel: { type: String, default: 'Average' }
})

const canvas = ref(null)

const normalizedData = computed(() => {
  if (!props.data.length) return []
  return props.data.map(v => Math.max(0, Math.min(100, v)))
})

const normalizedComparison = computed(() => {
  if (!props.comparisonData.length) return []
  return props.comparisonData.map(v => Math.max(0, Math.min(100, v)))
})

function draw() {
  const el = canvas.value
  if (!el || !normalizedData.value.length) return

  const ctx = el.getContext('2d')
  const w = el.width = el.offsetWidth * 2
  const h = el.height = props.height * 2
  ctx.scale(2, 2)

  const width = el.offsetWidth
  const height = props.height
  const padding = { top: 10, right: 10, bottom: 30, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  ctx.clearRect(0, 0, width, height)

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  // Y-axis labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.font = '10px Inter, sans-serif'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotH / 4) * i
    ctx.fillText(`${100 - i * 25}%`, padding.left - 8, y + 3)
  }

  // X-axis labels
  ctx.textAlign = 'center'
  const points = normalizedData.value.length
  for (let i = 0; i < points; i++) {
    const x = padding.left + (plotW / (points - 1)) * i
    ctx.fillText(`${(i / (points - 1) * 100).toFixed(0)}%`, x, height - 5)
  }

  function drawLine(data, color, fill = false) {
    if (!data.length) return
    const pts = data.map((v, i) => ({
      x: padding.left + (plotW / (data.length - 1)) * i,
      y: padding.top + plotH - (v / 100) * plotH
    }))

    if (fill) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, padding.top + plotH)
      pts.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.lineTo(pts[pts.length - 1].x, padding.top + plotH)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH)
      gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'))
      gradient.addColorStop(1, color.replace(')', ', 0.02)').replace('rgb', 'rgba'))
      ctx.fillStyle = gradient
      ctx.fill()
    }

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const cx = (pts[i - 1].x + pts[i].x) / 2
      ctx.bezierCurveTo(cx, pts[i - 1].y, cx, pts[i].y, pts[i].x, pts[i].y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    // Dots
    pts.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    })
  }

  if (normalizedComparison.value.length) {
    drawLine(normalizedComparison.value, 'rgb(100, 100, 140)')
  }
  drawLine(normalizedData.value, 'rgb(255, 68, 68)', true)
}

watch([normalizedData, normalizedComparison], draw)
onMounted(() => setTimeout(draw, 100))
</script>

<template>
  <div class="chart-container">
    <div class="chart-legend">
      <span class="legend-item">
        <span class="legend-dot accent" />
        {{ label }}
      </span>
      <span class="legend-item" v-if="comparisonData.length">
        <span class="legend-dot muted" />
        {{ comparisonLabel }}
      </span>
    </div>
    <canvas ref="canvas" :style="{ height: `${height}px`, width: '100%' }" />
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
}

canvas {
  display: block;
}

.chart-legend {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-sm);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.accent { background: var(--color-accent); }
.legend-dot.muted { background: rgb(100, 100, 140); }
</style>
