<script setup>
defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '20px' },
  rounded: { type: Boolean, default: false },
  count: { type: Number, default: 1 }
})
</script>

<template>
  <div class="skeleton-group">
    <div
      v-for="i in count"
      :key="i"
      class="skeleton"
      :class="{ 'skeleton-rounded': rounded }"
      :style="{ width, height }"
    />
  </div>
</template>

<style scoped>
.skeleton-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-card) 25%,
    var(--color-bg-card-hover) 50%,
    var(--color-bg-card) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

.skeleton-rounded {
  border-radius: var(--radius-full);
}
</style>
