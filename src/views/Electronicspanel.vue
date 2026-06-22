<script setup>
import { ref, computed } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import {
  PhListChecks, PhPlugs, PhClipboardText, PhPlus, PhTrash,
  PhCurrencyDollar, PhCheckCircle,
} from '@phosphor-icons/vue'

const props = defineProps({
  idea: { type: Object, required: true },
})

const ideasStore = useIdeasStore()

// Persist a partial update to the idea via the store.
// Assumes ideasStore.updateIdea(id, patch); swap for your real action if named differently.
function persist(patch) {
  if (ideasStore.updateIdea) {
    ideasStore.updateIdea(props.idea.id, patch)
  } else {
    Object.assign(props.idea, patch) // fallback: local mutation
  }
}

const uid = () => Math.random().toString(36).slice(2, 9)

// ── BOM ─────────────────────────────────────────────────────────────────────
const bom = computed({
  get: () => props.idea.bom || [],
  set: (v) => persist({ bom: v }),
})
const STATUSES = ['needed', 'ordered', 'have']

function addPart() {
  bom.value = [...bom.value, { id: uid(), name: '', qty: 1, value: '', supplier: '', price: 0, status: 'needed' }]
}
function updatePart(id, key, val) {
  bom.value = bom.value.map(p => p.id === id ? { ...p, [key]: val } : p)
}
function removePart(id) {
  bom.value = bom.value.filter(p => p.id !== id)
}
const totalCost = computed(() =>
  bom.value.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.qty) || 1), 0)
)
const orderedCount = computed(() =>
  bom.value.filter(p => p.status === 'ordered' || p.status === 'have').length
)

// ── Pinout / wiring ──────────────────────────────────────────────────────────
const pinout = computed({
  get: () => props.idea.pinout || [],
  set: (v) => persist({ pinout: v }),
})
function addPin() {
  pinout.value = [...pinout.value, { id: uid(), from: '', to: '', note: '' }]
}
function updatePin(id, key, val) {
  pinout.value = pinout.value.map(p => p.id === id ? { ...p, [key]: val } : p)
}
function removePin(id) {
  pinout.value = pinout.value.filter(p => p.id !== id)
}

// ── Build / test log ─────────────────────────────────────────────────────────
const buildLog = computed({
  get: () => props.idea.buildLog || [],
  set: (v) => persist({ buildLog: v }),
})
const newLogText = ref('')
const newLogResult = ref('note') // note | pass | fail

function addLog() {
  if (!newLogText.value.trim()) return
  buildLog.value = [
    { id: uid(), text: newLogText.value.trim(), result: newLogResult.value, at: new Date().toISOString() },
    ...buildLog.value,
  ]
  newLogText.value = ''
  newLogResult.value = 'note'
}
function removeLog(id) {
  buildLog.value = buildLog.value.filter(e => e.id !== id)
}
function fmt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="ep">

    <!-- ── BOM ──────────────────────────────────────────────────────────── -->
    <section class="ep__card">
      <header class="ep__head">
        <div class="ep__title"><PhListChecks :size="18" weight="bold" /> Bill of Materials</div>
        <div class="ep__head-meta">
          <span class="ep__pill"><PhCheckCircle :size="12" weight="bold" /> {{ orderedCount }}/{{ bom.length }} sourced</span>
          <span class="ep__pill ep__pill--cost"><PhCurrencyDollar :size="12" weight="bold" /> {{ totalCost.toFixed(2) }}</span>
        </div>
      </header>

      <div v-if="bom.length" class="ep__table">
        <div class="ep__row ep__row--head">
          <span>Part</span><span>Qty</span><span>Value</span><span>Supplier</span><span>Unit $</span><span>Status</span><span></span>
        </div>
        <div v-for="p in bom" :key="p.id" class="ep__row">
          <input class="ep__in" :value="p.name" @input="updatePart(p.id, 'name', $event.target.value)" placeholder="e.g. ATmega328P" />
          <input class="ep__in ep__in--num" type="number" min="1" :value="p.qty" @input="updatePart(p.id, 'qty', Number($event.target.value))" />
          <input class="ep__in" :value="p.value" @input="updatePart(p.id, 'value', $event.target.value)" placeholder="10kΩ" />
          <input class="ep__in" :value="p.supplier" @input="updatePart(p.id, 'supplier', $event.target.value)" placeholder="Digi-Key" />
          <input class="ep__in ep__in--num" type="number" min="0" step="0.01" :value="p.price" @input="updatePart(p.id, 'price', Number($event.target.value))" />
          <select class="ep__in ep__select" :value="p.status" @change="updatePart(p.id, 'status', $event.target.value)" :data-status="p.status">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
          <button class="ep__icon-btn" @click="removePart(p.id)" aria-label="Remove part"><PhTrash :size="14" /></button>
        </div>
      </div>
      <p v-else class="ep__empty">No parts yet.</p>

      <button class="ep__add" @click="addPart"><PhPlus :size="13" weight="bold" /> Add part</button>
    </section>

    <!-- ── Pinout / wiring ──────────────────────────────────────────────── -->
    <section class="ep__card">
      <header class="ep__head">
        <div class="ep__title"><PhPlugs :size="18" weight="bold" /> Pinout & Wiring</div>
      </header>

      <div v-if="pinout.length" class="ep__pins">
        <div v-for="p in pinout" :key="p.id" class="ep__pin">
          <input class="ep__in" :value="p.from" @input="updatePin(p.id, 'from', $event.target.value)" placeholder="D2" />
          <span class="ep__arrow">→</span>
          <input class="ep__in" :value="p.to" @input="updatePin(p.id, 'to', $event.target.value)" placeholder="Relay IN" />
          <input class="ep__in ep__in--note" :value="p.note" @input="updatePin(p.id, 'note', $event.target.value)" placeholder="note (e.g. active-low)" />
          <button class="ep__icon-btn" @click="removePin(p.id)" aria-label="Remove pin"><PhTrash :size="14" /></button>
        </div>
      </div>
      <p v-else class="ep__empty">No connections mapped yet.</p>

      <button class="ep__add" @click="addPin"><PhPlus :size="13" weight="bold" /> Add connection</button>
    </section>

    <!-- ── Build / test log ─────────────────────────────────────────────── -->
    <section class="ep__card">
      <header class="ep__head">
        <div class="ep__title"><PhClipboardText :size="18" weight="bold" /> Build & Test Log</div>
      </header>

      <div class="ep__log-input">
        <input
          class="ep__in ep__in--log"
          v-model="newLogText"
          placeholder="e.g. 3.3V rail measured 3.28V"
          @keydown.enter="addLog"
        />
        <select class="ep__in ep__select" v-model="newLogResult" :data-result="newLogResult">
          <option value="note">note</option>
          <option value="pass">pass</option>
          <option value="fail">fail</option>
        </select>
        <button class="ep__add ep__add--inline" @click="addLog"><PhPlus :size="13" weight="bold" /> Log</button>
      </div>

      <ul v-if="buildLog.length" class="ep__log">
        <li v-for="e in buildLog" :key="e.id" class="ep__log-item" :data-result="e.result">
          <span class="ep__log-dot" :data-result="e.result" />
          <div class="ep__log-body">
            <span class="ep__log-text">{{ e.text }}</span>
            <span class="ep__log-time">{{ fmt(e.at) }}</span>
          </div>
          <button class="ep__icon-btn" @click="removeLog(e.id)" aria-label="Remove entry"><PhTrash :size="13" /></button>
        </li>
      </ul>
      <p v-else class="ep__empty">No log entries yet.</p>
    </section>

  </div>
</template>

<style scoped>
.ep {
  --accent: #0F9D77;
  --accent-deep: #0B6E54;
  --accent-soft: #E3F6EF;
  --accent-edge: #93D9C3;
  display: flex; flex-direction: column; gap: var(--space-lg, 20px);
}

.ep__card {
  background: var(--color-bg-card, var(--color-background-primary));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-lg, 18px);
}
.ep__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-md, 14px);
  gap: var(--space-sm);
}
.ep__title {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700;
  color: var(--color-text-primary);
}
.ep__title svg { color: var(--accent); }
.ep__head-meta { display: flex; gap: 8px; }
.ep__pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 99px;
  background: var(--accent-soft); color: var(--accent-deep);
  border: 0.5px solid var(--accent-edge);
}
.ep__pill--cost { background: #FFF6E5; color: #8A5A00; border-color: #F0D49A; }

/* Table */
.ep__table { display: flex; flex-direction: column; gap: 6px; }
.ep__row {
  display: grid;
  grid-template-columns: 1.6fr 0.5fr 0.8fr 1fr 0.7fr 0.9fr 32px;
  gap: 6px; align-items: center;
}
.ep__row--head {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--color-text-muted);
  padding: 0 4px;
}
.ep__in {
  width: 100%; box-sizing: border-box;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 6px 8px; border-radius: 6px;
  font: inherit; font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.ep__in:focus { border-color: var(--accent); }
.ep__in--num { text-align: center; }
.ep__select { cursor: pointer; }
.ep__select[data-status="have"]    { color: var(--accent-deep); font-weight: 600; }
.ep__select[data-status="ordered"] { color: #8A5A00; font-weight: 600; }

.ep__icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: none; background: transparent;
  color: var(--color-text-muted); cursor: pointer;
  border-radius: 6px; transition: background 0.12s, color 0.12s;
}
.ep__icon-btn:hover { background: #FDE8E8; color: #C0392B; }

.ep__empty { font-size: 13px; color: var(--color-text-muted); padding: 4px 0; margin: 0; }

.ep__add {
  margin-top: var(--space-md, 12px);
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 6px;
  border: 1px dashed var(--accent-edge);
  background: transparent; color: var(--accent-deep);
  font: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background 0.12s;
}
.ep__add:hover { background: var(--accent-soft); }
.ep__add--inline { margin-top: 0; border-style: solid; }

/* Pinout */
.ep__pins { display: flex; flex-direction: column; gap: 6px; }
.ep__pin {
  display: grid;
  grid-template-columns: 1fr 20px 1fr 1.6fr 32px;
  gap: 6px; align-items: center;
}
.ep__arrow { text-align: center; color: var(--accent); font-weight: 700; }

/* Log */
.ep__log-input {
  display: grid; grid-template-columns: 1fr 0.7fr auto; gap: 6px;
  margin-bottom: var(--space-md, 12px);
}
.ep__select[data-result="pass"] { color: var(--accent-deep); font-weight: 600; }
.ep__select[data-result="fail"] { color: #C0392B; font-weight: 600; }

.ep__log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ep__log-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 8px;
  background: var(--color-bg-input);
  border: 0.5px solid var(--color-border);
}
.ep__log-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  background: var(--color-text-muted);
}
.ep__log-dot[data-result="pass"] { background: var(--accent); }
.ep__log-dot[data-result="fail"] { background: #C0392B; }
.ep__log-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.ep__log-text { font-size: 13px; color: var(--color-text-primary); }
.ep__log-time { font-size: 10px; color: var(--color-text-muted); }

@media (max-width: 640px) {
  .ep__row { grid-template-columns: 1fr 0.5fr 0.9fr 0.8fr 32px; }
  .ep__row span:nth-child(4), .ep__row .ep__in:nth-child(4) { display: none; } /* hide supplier on narrow */
}
</style>