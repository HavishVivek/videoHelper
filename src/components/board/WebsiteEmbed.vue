<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
    url: { type: String, required: true },
    height: { type: Number, default: 420 },
})

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

// 'loading' | 'iframe' | 'proxy' | 'screenshot' | 'error'
const state = ref('loading')
const title = ref(null)
const finalUrl = ref(props.url)
const iframeKey = ref(0) // bump to force iframe reload

const domain = computed(() => {
    try {
        return new URL(finalUrl.value).hostname.replace(/^www\./, '')
    } catch {
        return props.url
    }
})

const faviconSrc = computed(
    () => `https://www.google.com/s2/favicons?domain=${domain.value}&sz=64`
)

const iframeSrc = computed(() => {
    if (state.value === 'iframe') return finalUrl.value
    if (state.value === 'proxy')
        return `${API_BASE}/api/embed/render?url=${encodeURIComponent(finalUrl.value)}`
    return null
})

const screenshotSrc = computed(
    () => `https://image.thum.io/get/width/900/${finalUrl.value}`
)

const modeBadge = computed(() => {
    if (state.value === 'iframe') return { label: 'Live', cls: 'live' }
    if (state.value === 'proxy') return { label: 'Reader', cls: 'reader' }
    if (state.value === 'screenshot') return { label: 'Snapshot', cls: 'snap' }
    return null
})

async function check() {
    state.value = 'loading'
    try {
        const res = await fetch(
            `${API_BASE}/api/embed/check?url=${encodeURIComponent(props.url)}`
        )
        if (!res.ok) throw new Error('check failed')
        const data = await res.json()
        title.value = data.title || null
        finalUrl.value = data.finalUrl || props.url
        state.value = data.tier // 'iframe' | 'proxy' | 'screenshot'
    } catch (err) {
        console.error('[WebsiteEmbed] check failed:', err)
        // Backend unreachable — screenshot tier needs no backend at all.
        state.value = 'screenshot'
    }
}

// If the proxy render itself 502s, the iframe shows the error body;
// give the user a manual escape hatch that also runs automatically
// via cycleView. Cycle order: iframe → proxy → screenshot → iframe.
function cycleView() {
    if (state.value === 'iframe') state.value = 'proxy'
    else if (state.value === 'proxy') state.value = 'screenshot'
    else state.value = 'iframe'
    iframeKey.value++
}

function refresh() {
    if (state.value === 'screenshot') {
        // thum.io caches; bust with a reload param on the img
        iframeKey.value++
    } else {
        iframeKey.value++
    }
}

function openExternal() {
    window.open(finalUrl.value, '_blank', 'noopener,noreferrer')
}

onMounted(check)
watch(() => props.url, check)
</script>

<template>
    <div class="website-embed" :style="{ height: height + 'px' }">
        <!-- Header bar -->
        <div class="embed-header">
            <img :src="faviconSrc" class="favicon" alt="" @error="$event.target.style.visibility = 'hidden'" />
            <span class="embed-title" :title="title || finalUrl">{{ title || domain }}</span>
            <span class="embed-domain">{{ domain }}</span>

            <span v-if="modeBadge" class="mode-badge" :class="modeBadge.cls">
                {{ modeBadge.label }}
            </span>

            <button class="hbtn" title="Switch view mode" @click="cycleView">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>
            <button class="hbtn" title="Reload" @click="refresh">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                </svg>
            </button>
            <button class="hbtn" title="Open in new tab" @click="openExternal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                </svg>
            </button>
        </div>

        <!-- Body -->
        <div class="embed-body">
            <!-- Loading: scan bar -->
            <div v-if="state === 'loading'" class="loader-wrap">
                <div class="scan-track">
                    <div class="scan-bar" />
                </div>
                <div class="loader-row">
                    <span class="fav-pulse" />
                    <span class="shim shim-line" />
                </div>
                <p class="loader-text">Checking how {{ domain }} can be embedded…</p>
            </div>

            <!-- Tier 1 + 2: iframe (direct or proxied) -->
            <iframe v-else-if="iframeSrc" :key="state + '-' + iframeKey" :src="iframeSrc" class="embed-frame"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"
                loading="lazy" />

            <!-- Tier 3: screenshot fallback -->
            <div v-else-if="state === 'screenshot'" class="snap-wrap" @click="openExternal">
                <img :key="iframeKey" :src="screenshotSrc" class="snap-img" alt="" loading="lazy" />
                <div class="snap-overlay">
                    <span class="snap-hint">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <path d="M15 3h6v6" />
                            <path d="M10 14 21 3" />
                        </svg>
                        Snapshot — click to open the live site
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.website-embed {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-card, #1e1d27);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-md, 12px);
    overflow: hidden;
}

/* ---------- Header ---------- */
.embed-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
    min-width: 0;
}

.favicon {
    width: 15px;
    height: 15px;
    border-radius: 3px;
    flex-shrink: 0;
}

.embed-title {
    font-size: var(--font-size-xs, 12px);
    font-weight: 600;
    color: var(--color-text-primary, #ecebf2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}

.embed-domain {
    font-size: 10px;
    color: var(--color-text-muted, #8b8996);
    white-space: nowrap;
    flex-shrink: 0;
}

.mode-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 20px;
    flex-shrink: 0;
    margin-left: auto;
}

.mode-badge.live {
    color: #5dcaa5;
    background: rgba(29, 158, 117, 0.12);
}

.mode-badge.reader {
    color: #afa9ec;
    background: rgba(127, 119, 221, 0.15);
}

.mode-badge.snap {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
}

.hbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #8b8996);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease;
}

.hbtn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary, #ecebf2);
}

/* ---------- Body ---------- */
.embed-body {
    flex: 1;
    min-height: 0;
    position: relative;
    background: #131219;
}

.embed-frame {
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
}

/* ---------- Loader (scan bar) ---------- */
.loader-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 14%;
    gap: 14px;
}

.scan-track {
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    position: relative;
}

.scan-bar {
    position: absolute;
    top: 0;
    left: -35%;
    height: 100%;
    width: 35%;
    border-radius: 2px;
    background: linear-gradient(90deg, #7f77dd, #1d9e75);
    animation: scan 1.3s infinite ease-in-out;
}

@keyframes scan {
    from {
        left: -35%;
    }

    to {
        left: 100%;
    }
}

.loader-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.fav-pulse {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: rgba(127, 119, 221, 0.35);
    animation: pulse 1.2s infinite ease-in-out;
    flex-shrink: 0;
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(0.75);
        opacity: 0.4;
    }

    50% {
        transform: scale(1);
        opacity: 1;
    }
}

.shim {
    background: linear-gradient(90deg,
            rgba(255, 255, 255, 0.06) 25%,
            rgba(255, 255, 255, 0.16) 50%,
            rgba(255, 255, 255, 0.06) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
}

.shim-line {
    height: 9px;
    border-radius: 5px;
    width: 45%;
}

@keyframes shimmer {
    from {
        background-position: 200% 0;
    }

    to {
        background-position: -200% 0;
    }
}

.loader-text {
    font-size: 11px;
    color: var(--color-text-muted, #8b8996);
    margin: 0;
}

/* ---------- Screenshot fallback ---------- */
.snap-wrap {
    position: absolute;
    inset: 0;
    cursor: pointer;
    overflow: hidden;
}

.snap-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
}

.snap-overlay {
    position: absolute;
    inset: auto 0 0 0;
    padding: 24px 12px 10px;
    background: linear-gradient(transparent, rgba(19, 18, 25, 0.85));
    display: flex;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.18s ease;
}

.snap-wrap:hover .snap-overlay {
    opacity: 1;
}

.snap-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #ecebf2;
}
</style>