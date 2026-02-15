<script setup>
defineProps({
  title: String,
  subtitle: String
})
</script>

<template>
  <div class="page-container animate-fade-in-up">
    <header class="page-header" v-if="title">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-subtitle" v-if="subtitle">{{ subtitle }}</p>
      <slot name="actions" />
    </header>
    <slot />
  </div>
</template>

<style scoped>
.page-container {
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}

.page-header {
  margin-bottom: var(--space-2xl);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-md);
}

.page-title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}
</style>
