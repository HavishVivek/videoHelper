<script setup>
import { computed, toRef } from 'vue'
import { useCountUp } from '@/composables/useCountUp'

const props = defineProps({
    done: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    // stagger the count-up to line up with the card's rise-in
    delay: { type: Number, default: 0 },
})

const pct = computed(() =>
    props.total ? Math.round((props.done / props.total) * 100) : 0
)

const livePct = useCountUp(() => pct.value, { startDelay: props.delay })
</script>

<template>
    <div class="subtask-preview">
        <span class="subtask-count">{{ done }}/{{ total }} tasks · {{ livePct }}%</span>
        <div class="subtask-bar">
            <div class="subtask-bar-fill" :style="{ width: pct + '%' }" />
        </div>
    </div>
</template>

<style scoped>
.subtask-preview {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.subtask-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
}

.subtask-bar {
    flex: 1;
    height: 4px;
    background: var(--color-bg-input);
    border-radius: 2px;
    overflow: hidden;
}

.subtask-bar-fill {
    height: 100%;
    width: 0;
    background: var(--color-accent);
    border-radius: 2px;
    animation: bar-grow 1s cubic-bezier(.22, .61, .36, 1) forwards;
}

@media (prefers-reduced-motion: reduce) {
    .subtask-bar-fill {
        animation: none;
    }
}

@keyframes bar-grow {
    from {
        width: 0;
    }
}
</style>