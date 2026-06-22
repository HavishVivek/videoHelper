<script setup>
defineProps({
  icon: { type: Object, required: true },
  size:   { type: [Number, String], default: 18 },
  weight: { type: String, default: 'regular' },
  color:  { type: String, default: 'currentColor' },
})
</script>

<template>
  <component :is="icon" :size="size" :weight="weight" :color="color" />
</template>