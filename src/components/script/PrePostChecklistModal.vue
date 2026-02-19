<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps({
  modelValue: Boolean,
  ideaId: { type: String, default: null }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const REQUIRED_ITEMS = [
  { id: 'script', label: 'Script is finalized' },
  { id: 'filmed', label: 'Video filmed and edited' },
  { id: 'thumbnail', label: 'Thumbnail ready' },
  { id: 'title', label: 'Title chosen' },
  { id: 'description', label: 'Description written' },
  { id: 'tags', label: 'Tags added' },
]

const OPTIONAL_ITEMS = [
  { id: 'endscreen', label: 'End screen configured' },
  { id: 'cards', label: 'Cards / annotations added' },
  { id: 'captions', label: 'Subtitles / captions uploaded' },
  { id: 'pinned', label: 'Pinned comment ready' },
  { id: 'social', label: 'Shared on social media' },
]

const checked = ref(new Set())

function storageKey(ideaId) {
  return `checklist_${ideaId}`
}

function loadChecked(ideaId) {
  if (!ideaId) return new Set()
  try {
    const saved = localStorage.getItem(storageKey(ideaId))
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch {
    return new Set()
  }
}

function saveChecked(ideaId, set) {
  if (!ideaId) return
  localStorage.setItem(storageKey(ideaId), JSON.stringify([...set]))
}

function clearChecked(ideaId) {
  if (!ideaId) return
  localStorage.removeItem(storageKey(ideaId))
}

function toggle(id) {
  if (checked.value.has(id)) {
    checked.value.delete(id)
  } else {
    checked.value.add(id)
  }
  saveChecked(props.ideaId, checked.value)
}

const allRequiredChecked = computed(() =>
  REQUIRED_ITEMS.every(item => checked.value.has(item.id))
)

watch(() => props.modelValue, (val) => {
  if (val) checked.value = loadChecked(props.ideaId)
})

function handleClose() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
  clearChecked(props.ideaId)
  checked.value = new Set()
}
</script>

<template>
  <BaseModal :modelValue="modelValue" @update:modelValue="handleClose" title="Ready to post?" maxWidth="480px">
    <div class="checklist-body">

      <section class="checklist-section">
        <p class="section-label">Required — must all be checked</p>
        <ul class="checklist">
          <li
            v-for="item in REQUIRED_ITEMS"
            :key="item.id"
            class="checklist-item"
            @click="toggle(item.id)"
          >
            <span class="checkbox" :class="{ checked: checked.has(item.id) }">
              <svg v-if="checked.has(item.id)" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <polyline points="2,6 5,9 10,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="item-label" :class="{ 'item-done': checked.has(item.id) }">{{ item.label }}</span>
          </li>
        </ul>
      </section>

      <section class="checklist-section optional-section">
        <p class="section-label optional-label">Optional</p>
        <ul class="checklist">
          <li
            v-for="item in OPTIONAL_ITEMS"
            :key="item.id"
            class="checklist-item"
            @click="toggle(item.id)"
          >
            <span class="checkbox optional" :class="{ checked: checked.has(item.id) }">
              <svg v-if="checked.has(item.id)" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <polyline points="2,6 5,9 10,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="item-label" :class="{ 'item-done': checked.has(item.id) }">{{ item.label }}</span>
          </li>
        </ul>
      </section>

      <p v-if="!allRequiredChecked" class="warning-text">
        Check off all required items to confirm.
      </p>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="handleClose">Cancel</BaseButton>
      <BaseButton :disabled="!allRequiredChecked" @click="handleConfirm">
        Video is Posted
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.checklist-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.checklist-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.optional-section {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-lg);
}

.section-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  margin: 0;
}

.optional-label {
  color: var(--color-text-tertiary, var(--color-text-secondary));
}

.checklist {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.checklist-item:hover {
  background: var(--color-bg-card);
}

.checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: white;
}

.checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.checkbox.optional.checked {
  background: var(--color-text-secondary);
  border-color: var(--color-text-secondary);
}

.item-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: color var(--transition-fast);
}

.item-done {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}

.warning-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
}
</style>
