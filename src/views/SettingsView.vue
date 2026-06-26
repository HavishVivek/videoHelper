<script setup>
import { ref, reactive, computed } from 'vue'
import {
    PhUser, PhSliders, PhLock, PhMagnifyingGlass,
    PhCheck, PhSpinner, PhWarning, PhEye, PhEyeSlash, PhFolder,
} from '@phosphor-icons/vue'
import { useAuthStore } from '../stores/auth.js'
import { useSettingsStore } from '@/composables/Usesettingsstore.js'

// Firebase auth helpers (already used elsewhere in your app)
import {
    getAuth,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
} from 'firebase/auth'

const auth = useAuthStore()
const settings = useSettingsStore()

// ── Username ────────────────────────────────────────────────────────────────
const username = ref(auth.user?.displayName || '')
const nameState = reactive({ saving: false, ok: false, error: '' })

const nameChanged = computed(
    () => username.value.trim() && username.value.trim() !== (auth.user?.displayName || ''),
)

async function saveName() {
    if (!nameChanged.value) return
    nameState.saving = true
    nameState.ok = false
    nameState.error = ''
    try {
        const fbUser = getAuth().currentUser
        if (!fbUser) throw new Error('Not signed in.')

        await updateProfile(fbUser, { displayName: username.value.trim() })
        await fbUser.reload()

        // keep your store's display copy in sync (adjust to your store's API)
        if (auth.user) auth.user.displayName = username.value.trim()

        nameState.ok = true
        setTimeout(() => (nameState.ok = false), 2200)
    } catch (e) {
        nameState.error = e.message || 'Could not save your name.'
    } finally {
        nameState.saving = false
    }
}

// ── Search blur ─────────────────────────────────────────────────────────────
// settings.searchBlur is shared live with Foldersearch.vue's overlay.
const blurLabel = computed(() => {
    const b = settings.searchBlur
    if (b <= 2) return 'Clear'
    if (b <= 7) return 'Light'
    if (b <= 13) return 'Medium'
    return 'Heavy'
})

// ── Password ────────────────────────────────────────────────────────────────
const pw = reactive({
    current: '',
    next: '',
    confirm: '',
    showCurrent: false,
    showNext: false,
    saving: false,
    ok: false,
    error: '',
})

const pwStrength = computed(() => {
    const v = pw.next
    if (!v) return { score: 0, label: '' }
    let s = 0
    if (v.length >= 8) s++
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++
    if (/\d/.test(v)) s++
    if (/[^A-Za-z0-9]/.test(v)) s++
    return { score: s, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][s] }
})

const pwValid = computed(
    () => pw.current && pw.next.length >= 8 && pw.next === pw.confirm,
)

async function savePassword() {
    if (!pwValid.value) return
    pw.saving = true
    pw.ok = false
    pw.error = ''
    try {
        const fbUser = getAuth().currentUser
        if (!fbUser) throw new Error('Not signed in.')

        const cred = EmailAuthProvider.credential(fbUser.email, pw.current)
        await reauthenticateWithCredential(fbUser, cred)
        await updatePassword(fbUser, pw.next)

        pw.ok = true
        pw.current = pw.next = pw.confirm = ''
        setTimeout(() => (pw.ok = false), 2600)
    } catch (e) {
        pw.error =
            e.code === 'auth/wrong-password'
                ? 'Your current password is incorrect.'
                : e.code === 'auth/weak-password'
                    ? 'Pick a stronger password (at least 8 characters).'
                    : e.message || 'Could not update your password.'
    } finally {
        pw.saving = false
    }
}
</script>

<template>
    <div class="settings">
        <header class="settings__head">
            <h1 class="settings__title">Settings</h1>
            <p class="settings__sub">Manage your profile, search, and account security.</p>
        </header>

        <!-- ── Profile ─────────────────────────────────────────────────────── -->
        <section class="card">
            <div class="card__head">
                <div class="card__icon">
                    <PhUser :size="18" weight="bold" />
                </div>
                <div>
                    <h2 class="card__title">Profile</h2>
                    <p class="card__hint">This name shows on your shared projects.</p>
                </div>
            </div>

            <label class="field">
                <span class="field__label">Username</span>
                <div class="field__row">
                    <input v-model="username" class="input" type="text" maxlength="40" placeholder="Your display name"
                        spellcheck="false" @keydown.enter="saveName" />
                    <button class="btn btn--primary" :disabled="!nameChanged || nameState.saving" @click="saveName">
                        <PhSpinner v-if="nameState.saving" class="spin" :size="14" weight="bold" />
                        <PhCheck v-else-if="nameState.ok" :size="14" weight="bold" />
                        <span>{{ nameState.ok ? 'Saved' : 'Save' }}</span>
                    </button>
                </div>
            </label>

            <p v-if="nameState.error" class="msg msg--error">
                <PhWarning :size="14" weight="fill" /> {{ nameState.error }}
            </p>
        </section>

        <!-- ── Search appearance ───────────────────────────────────────────── -->
        <section class="card">
            <div class="card__head">
                <div class="card__icon">
                    <PhSliders :size="18" weight="bold" />
                </div>
                <div>
                    <h2 class="card__title">Search results</h2>
                    <p class="card__hint">Control how much the page blurs behind the results panel.</p>
                </div>
            </div>

            <div class="field">
                <div class="field__label-row">
                    <span class="field__label">Background blur</span>
                    <span class="blur-chip">{{ blurLabel }} · {{ settings.searchBlur }}px</span>
                </div>
                <input v-model.number="settings.searchBlur" class="range" type="range" min="0" max="20" step="1" />
                <div class="range__scale">
                    <span>Clear</span>
                    <span>Heavy</span>
                </div>
            </div>

            <!-- Live preview -->
            <div class="preview" :style="{ '--dim': settings.searchDim }">
                <div class="preview__page">
                    <PhFolder :size="22" weight="fill" />
                    <PhFolder :size="22" weight="fill" />
                    <PhFolder :size="22" weight="fill" />
                </div>
                <div class="preview__backdrop"
                    :style="{ backdropFilter: `blur(${settings.searchBlur}px)`, WebkitBackdropFilter: `blur(${settings.searchBlur}px)` }" />
                <div class="preview__palette">
                    <PhMagnifyingGlass :size="15" weight="bold" />
                    <span>433mhz rf module</span>
                </div>
            </div>
        </section>

        <!-- ── Password ────────────────────────────────────────────────────── -->
        <section class="card">
            <div class="card__head">
                <div class="card__icon">
                    <PhLock :size="18" weight="bold" />
                </div>
                <div>
                    <h2 class="card__title">Password</h2>
                    <p class="card__hint">You'll need your current password to set a new one.</p>
                </div>
            </div>

            <label class="field">
                <span class="field__label">Current password</span>
                <div class="field__row">
                    <input v-model="pw.current" class="input" :type="pw.showCurrent ? 'text' : 'password'"
                        placeholder="••••••••" autocomplete="current-password" />
                    <button class="icon-btn" type="button" @click="pw.showCurrent = !pw.showCurrent"
                        :aria-label="pw.showCurrent ? 'Hide' : 'Show'">
                        <component :is="pw.showCurrent ? PhEyeSlash : PhEye" :size="16" />
                    </button>
                </div>
            </label>

            <label class="field">
                <span class="field__label">New password</span>
                <div class="field__row">
                    <input v-model="pw.next" class="input" :type="pw.showNext ? 'text' : 'password'"
                        placeholder="At least 8 characters" autocomplete="new-password" />
                    <button class="icon-btn" type="button" @click="pw.showNext = !pw.showNext"
                        :aria-label="pw.showNext ? 'Hide' : 'Show'">
                        <component :is="pw.showNext ? PhEyeSlash : PhEye" :size="16" />
                    </button>
                </div>
                <div v-if="pw.next" class="strength">
                    <div class="strength__bars">
                        <span v-for="n in 4" :key="n" class="strength__bar" :class="{ 'is-on': n <= pwStrength.score }"
                            :data-score="pwStrength.score" />
                    </div>
                    <span class="strength__label">{{ pwStrength.label }}</span>
                </div>
            </label>

            <label class="field">
                <span class="field__label">Confirm new password</span>
                <input v-model="pw.confirm" class="input" type="password" placeholder="Re-enter new password"
                    autocomplete="new-password" @keydown.enter="savePassword" />
                <span v-if="pw.confirm && pw.confirm !== pw.next" class="field__err">Passwords don't match.</span>
            </label>

            <div class="card__foot">
                <p v-if="pw.error" class="msg msg--error">
                    <PhWarning :size="14" weight="fill" /> {{ pw.error }}
                </p>
                <p v-else-if="pw.ok" class="msg msg--ok">
                    <PhCheck :size="14" weight="bold" /> Password updated.
                </p>
                <span v-else class="card__spacer" />

                <button class="btn btn--primary" :disabled="!pwValid || pw.saving" @click="savePassword">
                    <PhSpinner v-if="pw.saving" class="spin" :size="14" weight="bold" />
                    <span>{{ pw.saving ? 'Updating…' : 'Update password' }}</span>
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.settings {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 20px 64px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: #fff;
    /* The component is designed for a dark backdrop. The page it sits on is
       light, so give it its own dark surface — this is what makes the white
       text readable. */
    background: #14141b;
    min-height: 100vh;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.settings__head {
    margin-bottom: 4px;
}

.settings__title {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 4px;
    letter-spacing: -0.01em;
    color: #fff;
}

.settings__sub {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
}

/* ── Card ───────────────────────────────────────────────────────────────── */
.card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.card__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.card__icon {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(127, 119, 221, 0.18);
    color: #d6d2f7;
}

.card__title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 2px;
    color: #fff;
}

.card__hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.68);
    margin: 0;
    line-height: 1.4;
}

.card__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.card__spacer {
    flex: 1;
}

/* ── Fields ─────────────────────────────────────────────────────────────── */
.field {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.field__label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
}

.field__label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.field__row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.field__err {
    font-size: 11px;
    color: #ff9d92;
}

.input {
    flex: 1;
    min-width: 0;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    padding: 10px 13px;
    font: inherit;
    font-size: 14px;
    color: #fff;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
}

.input::placeholder {
    color: rgba(255, 255, 255, 0.5);
}

.input:focus {
    border-color: #7F77DD;
    box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.18);
}

.icon-btn {
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s;
}

.icon-btn:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.3);
}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    border-radius: 10px;
    border: none;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, opacity 0.15s;
}

.btn--primary {
    background: #7F77DD;
    color: #fff;
}

.btn--primary:not(:disabled):hover {
    background: #534AB7;
}

.btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.spin {
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Range / blur ───────────────────────────────────────────────────────── */
.blur-chip {
    font-size: 11px;
    font-weight: 600;
    color: #d6d2f7;
    background: rgba(127, 119, 221, 0.18);
    border: 0.5px solid rgba(175, 169, 236, 0.4);
    padding: 2px 9px;
    border-radius: 99px;
}

.range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.12);
    outline: none;
    cursor: pointer;
}

.range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #7F77DD;
    border: 2px solid #fff;
    box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.25);
    cursor: pointer;
}

.range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #7F77DD;
    border: 2px solid #fff;
    box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.25);
    cursor: pointer;
}

.range__scale {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 5px;
}

/* ── Blur preview ───────────────────────────────────────────────────────── */
.preview {
    position: relative;
    height: 120px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.preview__page {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    background:
        radial-gradient(circle at 30% 30%, rgba(127, 119, 221, 0.4), transparent 60%),
        radial-gradient(circle at 75% 70%, rgba(52, 152, 219, 0.35), transparent 55%),
        #1b1b24;
    color: rgba(255, 255, 255, 0.55);
}

.preview__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(10, 10, 14, var(--dim, 0.35));
    transition: backdrop-filter 0.12s;
}

.preview__palette {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.16);
}

.preview__palette svg {
    color: #AFA9EC;
}

/* ── Password strength ──────────────────────────────────────────────────── */
.strength {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 2px;
}

.strength__bars {
    display: flex;
    gap: 4px;
    flex: 1;
}

.strength__bar {
    flex: 1;
    height: 4px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.12);
    transition: background 0.2s;
}

.strength__bar.is-on[data-score="1"] {
    background: #e74c3c;
}

.strength__bar.is-on[data-score="2"] {
    background: #e6a23c;
}

.strength__bar.is-on[data-score="3"] {
    background: #7F77DD;
}

.strength__bar.is-on[data-score="4"] {
    background: #2ecc71;
}

.strength__label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.72);
    min-width: 56px;
    text-align: right;
}

/* ── Messages ───────────────────────────────────────────────────────────── */
.msg {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin: 0;
}

.msg--error {
    color: #ff9d92;
}

.msg--ok {
    color: #8ee0ac;
}

@media (prefers-reduced-motion: reduce) {
    .spin {
        animation: none;
    }
}
</style>