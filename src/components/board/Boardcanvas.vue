<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'

const props = defineProps({
    ideaId: { type: String, required: true },
    title: { type: String, default: '' },
    // Folder/section context for the side nav
    folderName: { type: String, default: 'Ideas' },
    // Subfolders inside the main folder. Each: { id, label, route, icon? }
    folderSections: {
        type: Array,
        default: () => [
            { id: 'board', label: 'Board', route: '/', icon: 'board' },
            { id: 'notes', label: 'Notes', route: '/', icon: 'note' },
            { id: 'links', label: 'Links', route: '/', icon: 'link' },
            { id: 'images', label: 'Images', route: '/', icon: 'image' },
        ]
    },
    activeSection: { type: String, default: 'board' },
})

const emit = defineEmits(['close', 'navigate', 'section-change'])
const ideasStore = useIdeasStore()
const router = useRouter()

// ── Side nav ──────────────────────────────────────────────────────────────────
const sideNavOpen = ref(false)

function toggleSideNav() { sideNavOpen.value = !sideNavOpen.value }
function closeSideNav() { sideNavOpen.value = false }

function goHome() {
    closeSideNav()
    emit('close')
    try {
        router.push('/')
    } catch {
        // No router in this context, rely on emit only
    }
}

// Navigate to any subfolder by its route
function goToSubfolder(sub) {
    closeSideNav()
    if (!sub?.route) return
    try {
        router.push(sub.route)
    } catch {
        // Fall back to emitting so a parent can handle navigation
        emit('navigate', sub)
    }
}

// ── State ──────────────────────────────────────────────────────────────────────
const cards = ref([])
const saving = ref(false)
const showAddPanel = ref(false)
const addPanelMode = ref(null)

const linkUrl = ref('')
const linkFetching = ref(false)
const linkError = ref('')
const linkInputEl = ref(null)
const linkModalOpen = ref(false)
const linkLoading = ref(false)
const linkLoadingUrl = ref('')

const noteText = ref('')
const noteColor = ref('white')
const noteInputEl = ref(null)
const noteModalOpen = ref(false)

const imageFileInput = ref(null)

const docModalOpen = ref(false)
const docTitle = ref('')
const docBody = ref('')
const docTitleEl = ref(null)

const editingId = ref(null)
const editingText = ref('')

// Inline editing for the expanded document
const docEditTitle = ref('')
const docEditBody = ref('')

// ── Context menu ──────────────────────────────────────────────────────────────
const contextMenu = ref({ visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0 })
const contextMenuEl = ref(null)

// ── Card context menu ─────────────────────────────────────────────────────────
const cardContextMenu = ref({ visible: false, x: 0, y: 0, card: null })



function closeCardContextMenu() {
    cardContextMenu.value.visible = false
}

function ctxEditNote() {
    const card = cardContextMenu.value.card
    closeCardContextMenu()
    startEdit(card)
}

async function ctxDeleteCard() {
    const card = cardContextMenu.value.card
    closeCardContextMenu()
    await removeCard(card.id)
}

// ── Expanded link (website viewer) ───────────────────────────────────────────


// ── Drag-to-move ──────────────────────────────────────────────────────────────
const canvasEl = ref(null)
const dragging = ref(null)

// ── Load / Save ────────────────────────────────────────────────────────────────
onMounted(() => {
    const idea = ideasStore.ideas.find(i => i.id === props.ideaId)
    cards.value = (idea?.boardCards || []).map(c => ({
        x: c.x ?? 0, y: c.y ?? 0, ...c
    }))
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('click', onGlobalClick)
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('click', onGlobalClick)
})

watch(() => props.ideaId, () => {
    const idea = ideasStore.ideas.find(i => i.id === props.ideaId)
    cards.value = (idea?.boardCards || []).map(c => ({ x: c.x ?? 0, y: c.y ?? 0, ...c }))
})

async function saveCards() {
    saving.value = true
    try {
        await ideasStore.updateIdea(props.ideaId, { boardCards: cards.value })
    } finally {
        saving.value = false
    }
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// ── Keyboard ──────────────────────────────────────────────────────────────────
function handleKeydown(e) {
    if (e.key === 'Escape') {
        closeAdd()
        expandedCard.value = null
        closeContextMenu()
    }
}

// ── Context menu ──────────────────────────────────────────────────────────────
// ── Context menu ──────────────────────────────────────────────────────────────
let justOpenedContextMenu = false

function onCanvasContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    justOpenedContextMenu = true
    const rect = canvasEl.value?.getBoundingClientRect() || { left: 0, top: 0 }
    contextMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        canvasX: e.clientX - rect.left,
        canvasY: e.clientY - rect.top,
    }
}

function onCardContextMenu(e, card) {
    e.preventDefault()
    e.stopPropagation()
    justOpenedContextMenu = true
    cardContextMenu.value = { visible: true, x: e.clientX, y: e.clientY, card }
}

function onGlobalClick() {
    if (justOpenedContextMenu) {
        justOpenedContextMenu = false
        return
    }
    closeContextMenu()
}

function closeContextMenu() {
    contextMenu.value.visible = false
    cardContextMenu.value.visible = false
}

function ctxPasteLink() {
    closeContextMenu()
    openAdd('link')
}

function ctxCreateNote() {
    closeContextMenu()
    openAdd('note')
}

function ctxAddImage() {
    closeContextMenu()
    imageFileInput.value?.click()
}

function ctxCreateDoc() {
    closeContextMenu()
    openAdd('doc')
}

// ── Add panel ─────────────────────────────────────────────────────────────────
// ── Add panel / modal ───────────────────────────────────────────────────────
function openAdd(mode) {
    closeContextMenu()
    if (mode === 'link') {
        linkModalOpen.value = true
        linkUrl.value = ''
        linkError.value = ''
        nextTick(() => linkInputEl.value?.focus())
        return
    }
    if (mode === 'note') {
        noteModalOpen.value = true
        noteText.value = ''
        noteColor.value = 'white'
        nextTick(() => noteInputEl.value?.focus())
        return
    }
    if (mode === 'doc') {
        docModalOpen.value = true
        docTitle.value = ''
        docBody.value = ''
        nextTick(() => docTitleEl.value?.focus())
        return
    }
}

function closeDocModal() {
    docModalOpen.value = false
    docTitle.value = ''
    docBody.value = ''
}

function closeLinkModal() {
    linkModalOpen.value = false
    linkUrl.value = ''
    linkError.value = ''
}

function closeNoteModal() {
    noteModalOpen.value = false
    noteText.value = ''
}


// ── Note colors ───────────────────────────────────────────────────────────────
const NOTE_COLORS = [
    { key: 'white', bg: '#ffffff', border: '#e5e7eb', text: '#111827' },
    { key: 'yellow', bg: '#fef9c3', border: '#fde047', text: '#713f12' },
    { key: 'blue', bg: '#dbeafe', border: '#93c5fd', text: '#1e3a5f' },
    { key: 'green', bg: '#dcfce7', border: '#86efac', text: '#14532d' },
    { key: 'pink', bg: '#fce7f3', border: '#f9a8d4', text: '#831843' },
    { key: 'purple', bg: '#ede9fe', border: '#c4b5fd', text: '#3b0764' },
]

function noteColorCfg(key) {
    return NOTE_COLORS.find(c => c.key === key) || NOTE_COLORS[0]
}

// ── Embed detection ───────────────────────────────────────────────────────────
function detectEmbed(url) {
    try {
        const u = new URL(url)
        const host = u.hostname.replace('www.', '')
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            let vid = u.searchParams.get('v')
            if (!vid && host === 'youtu.be') vid = u.pathname.slice(1).split('?')[0]
            if (vid) return { type: 'youtube', vid }
        }
        if (host.includes('twitter.com') || host.includes('x.com')) {
            return { type: 'twitter', url }
        }
    } catch { }
    return null
}

// ── Twitter embed ─────────────────────────────────────────────────────────────
async function fetchTweetEmbed(tweetUrl) {
    try {
        const res = await fetch(
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true&dnt=true`,
            { signal: AbortSignal.timeout(5000) }
        )
        const data = await res.json()
        return data.html || null
    } catch {
        return null
    }
}

let twitterScriptLoaded = false
function loadTwitterScript() {
    if (twitterScriptLoaded) {
        window.twttr?.widgets?.load()
        return
    }
    const s = document.createElement('script')
    s.src = 'https://platform.twitter.com/widgets.js'
    s.async = true
    s.onload = () => { twitterScriptLoaded = true; window.twttr?.widgets?.load() }
    document.head.appendChild(s)
}

// ── Next position ─────────────────────────────────────────────────────────────
function nextPos(overrideX, overrideY) {
    if (overrideX !== undefined && overrideY !== undefined) {
        return { x: overrideX, y: overrideY }
    }
    const count = cards.value.length
    return { x: 20 + (count % 4) * 290, y: 20 + Math.floor(count / 4) * 320 }
}

// ── Reader-mode content extractor ────────────────────────────────────────────
function extractReaderContent(rawHtml, baseUrl) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(rawHtml, 'text/html')

    // Set base for URL resolution
    let base = doc.querySelector('base') || doc.createElement('base')
    base.href = baseUrl
    doc.head.prepend(base)

    // Remove junk elements
    const junkSelectors = [
        'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside',
        'form', 'iframe', 'svg', 'dialog', 'figure.ad', '[class*="menu"]',
        '[class*="sidebar"]', '[class*="cookie"]', '[class*="banner"]',
        '[class*="popup"]', '[class*="overlay"]', '[class*="modal"]',
        '[id*="sidebar"]', '[id*="nav"]', '[id*="footer"]', '[id*="header"]',
        '[class*="social"]', '[class*="share"]', '[class*="related"]',
        '[class*="comment"]', '[class*="advert"]', '[class*="newsletter"]',
        '[class*="subscribe"]', '[class*="promo"]', '[aria-hidden="true"]',
    ]
    junkSelectors.forEach(sel => {
        try { doc.querySelectorAll(sel).forEach(el => el.remove()) } catch { }
    })

    // Score candidate containers by text density
    const candidates = [
        ...doc.querySelectorAll('article, [role="main"], main, [class*="article"], [class*="post-content"], [class*="entry-content"], [class*="story"], [class*="content"], [id*="content"], [id*="article"]')
    ]

    let best = doc.body
    let bestScore = 0

    for (const el of candidates) {
        const text = el.innerText || el.textContent || ''
        const score = text.trim().length - (el.querySelectorAll('*').length * 3)
        if (score > bestScore) {
            bestScore = score
            best = el
        }
    }

    // Resolve all asset URLs to absolute
    best.querySelectorAll('img[src]').forEach(img => {
        try {
            const abs = new URL(img.getAttribute('src'), baseUrl).href
            img.setAttribute('src', abs)
            img.style.cssText = 'max-width:100%;height:auto;border-radius:6px;margin:12px 0;'
            img.setAttribute('loading', 'lazy')
            // Remove tracking pixels
            const w = parseInt(img.getAttribute('width') || '99')
            const h = parseInt(img.getAttribute('height') || '99')
            if (w < 5 || h < 5) img.remove()
        } catch { img.remove() }
    })

    best.querySelectorAll('a[href]').forEach(a => {
        try { a.setAttribute('href', new URL(a.getAttribute('href'), baseUrl).href) } catch { }
        a.setAttribute('target', '_blank')
        a.setAttribute('rel', 'noopener noreferrer')
    })

    // Remove empty block elements that add clutter
    best.querySelectorAll('div, p, span').forEach(el => {
        if (!(el.textContent || '').trim() && !el.querySelector('img')) el.remove()
    })

    return best.innerHTML || ''
}

// ── Add Link ──────────────────────────────────────────────────────────────────
async function addLink() {
    const raw = linkUrl.value.trim()
    if (!raw) return
    linkFetching.value = true
    linkLoading.value = true
    linkLoadingUrl.value = raw
    linkError.value = ''
    closeLinkModal()
    try {
        const url = raw.startsWith('http') ? raw : 'https://' + raw
        const u = new URL(url)
        const domain = u.hostname.replace('www.', '')
        const embed = detectEmbed(url)

        let title = '', desc = '', ogImage = '', favicon = '', tweetHtml = '', readerHtml = ''

        if (embed?.type === 'twitter') {
            tweetHtml = await fetchTweetEmbed(url)
        }

        try {
            const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {
                signal: AbortSignal.timeout(10000)
            })
            const data = await res.json()
            const html = data.contents || ''
            const m = (prop) =>
                html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
                html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1] || ''
            title = m('og:title') || m('twitter:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || ''
            desc = m('og:description') || m('twitter:description') || m('description')
            ogImage = m('og:image') || m('twitter:image')
            favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
            // Extract readable article content
            if (html && !embed) {
                readerHtml = extractReaderContent(html, url)
            }
        } catch { }

        if (!title) {
            const path = u.pathname.split('/').filter(Boolean).pop() || ''
            title = path ? path.replace(/[-_]/g, ' ').replace(/\.\w+$/, '') : domain
        }

        if (embed?.type === 'youtube') {
            // maxresdefault is full HD; fall back to hqdefault if it 404s (handled in template)
            embed.thumbMax = `https://img.youtube.com/vi/${embed.vid}/maxresdefault.jpg`
            embed.thumbHq = `https://img.youtube.com/vi/${embed.vid}/hqdefault.jpg`
            ogImage = embed.thumbMax
        }

        const pos = nextPos(
            contextMenu.value.canvasX || undefined,
            contextMenu.value.canvasY || undefined
        )

        cards.value.unshift({
            id: uid(), type: 'link',
            url, title, desc, ogImage, favicon, domain, embed, tweetHtml, readerHtml,
            x: pos.x, y: pos.y,
            createdAt: new Date().toISOString()
        })
        await saveCards()
        closeAdd()

        if (embed?.type === 'twitter') {
            nextTick(() => loadTwitterScript())
        }
    } catch {
        linkError.value = 'Could not fetch link — check the URL.'
    } finally {
        linkFetching.value = false
        linkLoading.value = false
        linkLoadingUrl.value = ''
    }
}

// ── Add Note ──────────────────────────────────────────────────────────────────
async function addNote() {
    if (!noteText.value.trim()) return
    const pos = nextPos(
        contextMenu.value.canvasX || undefined,
        contextMenu.value.canvasY || undefined
    )
    cards.value.unshift({
        id: uid(), type: 'note',
        text: noteText.value.trim(),
        color: noteColor.value,
        x: pos.x, y: pos.y,
        createdAt: new Date().toISOString()
    })
    await saveCards()
    closeAdd()
}

// ── Add Document ────────────────────────────────────────────────────────────────
async function addDoc() {
    const title = docTitle.value.trim()
    const body = docBody.value
    if (!title && !body.trim()) return
    const pos = nextPos(
        contextMenu.value.canvasX || undefined,
        contextMenu.value.canvasY || undefined
    )
    cards.value.unshift({
        id: uid(), type: 'doc',
        title: title || 'Untitled document',
        body,
        x: pos.x, y: pos.y,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    })
    await saveCards()
    closeAdd()
}

function closeAdd() {
    showAddPanel.value = false
    addPanelMode.value = null
    linkModalOpen.value = false
    noteModalOpen.value = false
    docModalOpen.value = false
}

// ── Add Image ─────────────────────────────────────────────────────────────────
function triggerImagePick() { imageFileInput.value?.click() }

async function onImageFile(event) {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
        const pos = nextPos(
            contextMenu.value.canvasX || undefined,
            contextMenu.value.canvasY || undefined
        )
        cards.value.unshift({
            id: uid(), type: 'image',
            src: e.target.result, caption: '', name: file.name,
            x: pos.x, y: pos.y,
            createdAt: new Date().toISOString()
        })
        await saveCards()
        closeAdd()
    }
    reader.readAsDataURL(file)
    event.target.value = ''
}

function onCanvasDragOver(e) { e.preventDefault() }
async function onCanvasDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
        const rect = canvasEl.value?.getBoundingClientRect()
        const x = rect ? e.clientX - rect.left : 20
        const y = rect ? e.clientY - rect.top : 20
        cards.value.unshift({
            id: uid(), type: 'image',
            src: ev.target.result, caption: '', name: file.name,
            x, y,
            createdAt: new Date().toISOString()
        })
        await saveCards()
    }
    reader.readAsDataURL(file)
}

// ── Note editing ──────────────────────────────────────────────────────────────
function startEdit(card) { editingId.value = card.id; editingText.value = card.text }
async function commitEdit(card) {
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx].text = editingText.value
    editingId.value = null
    await saveCards()
}

async function updateCaption(card, val) {
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx].caption = val
    await saveCards()
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function removeCard(id) {
    cards.value = cards.value.filter(c => c.id !== id)
    if (expandedCard.value?.id === id) expandedCard.value = null
    await saveCards()
}

// ── Free-move drag ────────────────────────────────────────────────────────────
function onCardPointerDown(e, card) {
    if (['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'SELECT'].includes(e.target.tagName)) return
    if (editingId.value === card.id) return

    e.preventDefault()
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) {
        const [c] = cards.value.splice(idx, 1)
        cards.value.push(c)
    }

    dragging.value = {
        id: card.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: card.x ?? 0,
        origY: card.y ?? 0,
    }
}

function onPointerMove(e) {
    if (!dragging.value) return
    const dx = e.clientX - dragging.value.startX
    const dy = e.clientY - dragging.value.startY
    const idx = cards.value.findIndex(c => c.id === dragging.value.id)
    if (idx !== -1) {
        cards.value[idx].x = Math.max(0, dragging.value.origX + dx)
        cards.value[idx].y = Math.max(0, dragging.value.origY + dy)
    }
}

async function onPointerUp() {
    if (!dragging.value) return
    dragging.value = null
    await saveCards()
}

function canvasSize() {
    let maxX = 800, maxY = 600
    for (const c of cards.value) {
        maxX = Math.max(maxX, (c.x ?? 0) + 300)
        maxY = Math.max(maxY, (c.y ?? 0) + 400)
    }
    return { width: maxX + 40, height: maxY + 40 }
}

const expandedCard = ref(null)
const readerLoading = ref(false)

const iframeBlocked = ref(false)

async function openExpanded(card) {
    expandedCard.value = card
    iframeBlocked.value = false

    if (card.type === 'doc') {
        docEditTitle.value = card.title || ''
        docEditBody.value = card.body || ''
        return
    }

    // For regular links, skip reader extraction — use iframe instead
    if (card.type === 'link' && !card.embed) {
        return  // iframe handles it in the template
    }
}

async function saveDocEdits() {
    const card = expandedCard.value
    if (!card || card.type !== 'doc') return
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) {
        cards.value[idx].title = docEditTitle.value.trim() || 'Untitled document'
        cards.value[idx].body = docEditBody.value
        cards.value[idx].updatedAt = new Date().toISOString()
        // keep the live reference in sync so the preview updates
        expandedCard.value = cards.value[idx]
    }
    await saveCards()
}

function closeExpanded() {
    expandedCard.value = null
}

function docSnippet(body) {
    const text = (body || '').replace(/\s+/g, ' ').trim()
    return text.length > 180 ? text.slice(0, 180) + '…' : text
}
</script>

<template>
    <div class="eden-board" @dragover="onCanvasDragOver" @drop="onCanvasDrop">

        <!-- ── Hidden file input for image picking ───────────────────────── -->
        <input ref="imageFileInput" type="file" accept="image/*" class="hidden-input" @change="onImageFile" />

        <!-- ── Link popup modal ──────────────────────────────────────────── -->
        <Transition name="modal">
            <div v-if="linkModalOpen" class="modal-overlay" @click.self="closeLinkModal">
                <div class="modal-card">
                    <div class="modal-head">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        <span class="modal-title">Paste a link</span>
                        <button class="modal-x" @click="closeLinkModal">✕</button>
                    </div>
                    <p class="modal-sub">YouTube, Twitter/X, articles — anything.</p>
                    <input ref="linkInputEl" v-model="linkUrl" class="modal-input" placeholder="https://..."
                        @keydown.enter="addLink" @keydown.escape="closeLinkModal" />
                    <p v-if="linkError" class="panel-error">{{ linkError }}</p>
                    <div class="modal-actions">
                        <button class="panel-cancel" @click="closeLinkModal">Cancel</button>
                        <button class="panel-submit" :disabled="linkFetching || !linkUrl.trim()" @click="addLink">
                            <span v-if="linkFetching" class="mini-spinner" />
                            <span v-else>Add Link</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- ── Note popup modal ──────────────────────────────────────────── -->
        <Transition name="modal">
            <div v-if="noteModalOpen" class="modal-overlay" @click.self="closeNoteModal">
                <div class="modal-card">
                    <div class="modal-head">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span class="modal-title">Write a note</span>
                        <button class="modal-x" @click="closeNoteModal">✕</button>
                    </div>
                    <div class="color-pills modal-pills">
                        <button v-for="nc in NOTE_COLORS" :key="nc.key" class="color-pill"
                            :class="{ active: noteColor === nc.key }"
                            :style="{ background: nc.bg, borderColor: nc.border }" @click="noteColor = nc.key" />
                    </div>
                    <textarea ref="noteInputEl" v-model="noteText" class="modal-textarea"
                        :style="{ background: noteColorCfg(noteColor).bg, color: noteColorCfg(noteColor).text }"
                        placeholder="Write something..." rows="4" @keydown.ctrl.enter="addNote"
                        @keydown.escape="closeNoteModal" />
                    <div class="modal-actions">
                        <span class="panel-hint">Ctrl+Enter to save</span>
                        <div class="panel-btns">
                            <button class="panel-cancel" @click="closeNoteModal">Cancel</button>
                            <button class="panel-submit" :disabled="!noteText.trim()" @click="addNote">Add Note</button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- ── Document popup modal ──────────────────────────────────────── -->
        <Transition name="modal">
            <div v-if="docModalOpen" class="modal-overlay" @click.self="closeDocModal">
                <div class="modal-card modal-card--doc">
                    <div class="modal-head">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <span class="modal-title">New document</span>
                        <button class="modal-x" @click="closeDocModal">✕</button>
                    </div>
                    <input ref="docTitleEl" v-model="docTitle" class="modal-input doc-title-input"
                        placeholder="Document title" @keydown.escape="closeDocModal" />
                    <textarea v-model="docBody" class="modal-textarea doc-body-input"
                        placeholder="Start writing…" rows="8" @keydown.ctrl.enter="addDoc"
                        @keydown.escape="closeDocModal" />
                    <div class="modal-actions">
                        <span class="panel-hint">Ctrl+Enter to save</span>
                        <div class="panel-btns">
                            <button class="panel-cancel" @click="closeDocModal">Cancel</button>
                            <button class="panel-submit" :disabled="!docTitle.trim() && !docBody.trim()"
                                @click="addDoc">Create</button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
        <Transition name="sidenav">
            <div v-if="sideNavOpen" class="sidenav-overlay" @click.self="closeSideNav">
                <nav class="sidenav">
                    <div class="sidenav-header">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span class="sidenav-app-name">Eden Board</span>
                        <button class="sidenav-close" @click="closeSideNav">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    <!-- Home -->
                    <div class="sidenav-section-label">Navigation</div>
                    <button class="sidenav-item" @click="goHome">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Home
                    </button>
                    <button class="sidenav-item sidenav-item--active">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                        </svg>
                        Idea Board
                    </button>

                    <!-- ── Main folder + its subfolders ───────────────────────── -->
                    <div class="sidenav-divider" />
                    <div class="sidenav-section-label">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        {{ props.folderName }}
                    </div>

                    <!-- Navigate to any subfolder inside the main folder -->
                    <div class="sidenav-folder-block">
                        <button v-for="sub in props.folderSections" :key="sub.id" class="sidenav-item sidenav-subfolder"
                            :class="{ 'sidenav-item--sub-active': props.activeSection === sub.id }"
                            @click="goToSubfolder(sub)">
                            <!-- Board -->
                            <template v-if="sub.icon === 'board'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                </svg>
                            </template>
                            <!-- Scripts / Note -->
                            <template v-else-if="sub.icon === 'scripts' || sub.icon === 'note'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                            </template>
                            <!-- Thumbnails / Image -->
                            <template v-else-if="sub.icon === 'thumbnails' || sub.icon === 'image'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                            </template>
                            <!-- Filmed Sections / Video -->
                            <template v-else-if="sub.icon === 'filmed' || sub.icon === 'video'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <polygon points="23 7 16 12 23 17 23 7" />
                                    <rect x="1" y="5" width="15" height="14" rx="2" />
                                </svg>
                            </template>
                            <!-- Link -->
                            <template v-else-if="sub.icon === 'link'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                            </template>
                            <!-- Generic folder fallback -->
                            <template v-else>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                            </template>
                            <span class="sidenav-subfolder-label">{{ sub.label }}</span>
                            <span v-if="props.activeSection === sub.id" class="sidenav-active-dot" />
                            <svg v-else class="sidenav-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2.2">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                        <p v-if="!props.folderSections.length" class="sidenav-empty-folder">No subfolders yet</p>
                    </div>

                    <div class="sidenav-divider" />
                    <div class="sidenav-footer">
                        <span>{{ cards.length }} item{{ cards.length !== 1 ? 's' : '' }} on board</span>
                    </div>
                </nav>
            </div>
        </Transition>

        <!-- ── Nav bar ─────────────────────────────────────────────────────────── -->
        <div class="board-nav">
            <!-- Hamburger -->
            <button class="hamburger-btn" @click="toggleSideNav" :class="{ open: sideNavOpen }" aria-label="Menu">
                <span class="ham-line" />
                <span class="ham-line" />
                <span class="ham-line" />
            </button>

            <!-- Breadcrumb -->
            <div class="board-breadcrumb">
                <button class="bread-home" @click="goHome" title="Home">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                </button>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <span class="bread-folder">{{ props.folderName }}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <span class="bread-current">{{ props.title }}</span>
            </div>

            <div class="board-nav-right">
                <span v-if="saving" class="saving-indicator">Saving…</span>
                <span class="card-count">{{ cards.length }} item{{ cards.length !== 1 ? 's' : '' }}</span>
                <span class="toolbar-hint">Right-click to add</span>
            </div>
        </div>

        <!-- ── Add panel (slides in from top when triggered via context menu) ──── -->
        <Transition name="panel">
            <div v-if="showAddPanel" class="add-panel">

                <!-- Link -->
                <div v-if="addPanelMode === 'link'" class="panel-inner">
                    <div class="panel-header">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        <span>Paste a link</span>
                        <span class="panel-hint-small">YouTube, Twitter/X, articles, anything</span>
                    </div>
                    <div class="panel-row">
                        <input ref="linkInputEl" v-model="linkUrl" class="panel-input" placeholder="https://..."
                            @keydown.enter="addLink" @keydown.escape="closeAdd" />
                        <button class="panel-submit" :disabled="linkFetching || !linkUrl.trim()" @click="addLink">
                            <span v-if="linkFetching" class="mini-spinner" />
                            <span v-else>Add</span>
                        </button>
                        <button class="panel-cancel" @click="closeAdd">✕</button>
                    </div>
                    <p v-if="linkError" class="panel-error">{{ linkError }}</p>
                </div>

                <!-- Note -->
                <div v-else-if="addPanelMode === 'note'" class="panel-inner">
                    <div class="panel-header">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Write a note</span>
                        <div class="color-pills">
                            <button v-for="nc in NOTE_COLORS" :key="nc.key" class="color-pill"
                                :class="{ active: noteColor === nc.key }"
                                :style="{ background: nc.bg, borderColor: nc.border }" @click="noteColor = nc.key" />
                        </div>
                    </div>
                    <div class="panel-row note-row">
                        <textarea ref="noteInputEl" v-model="noteText" class="panel-textarea"
                            :style="{ background: noteColorCfg(noteColor).bg, color: noteColorCfg(noteColor).text }"
                            placeholder="Write something..." rows="3" @keydown.ctrl.enter="addNote"
                            @keydown.escape="closeAdd" />
                    </div>
                    <div class="panel-footer">
                        <span class="panel-hint">Ctrl+Enter to save</span>
                        <div class="panel-btns">
                            <button class="panel-cancel" @click="closeAdd">Cancel</button>
                            <button class="panel-submit" :disabled="!noteText.trim()" @click="addNote">Add Note</button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- ── Canvas ─────────────────────────────────────────────────────────── -->
        <div class="canvas-scroll" @contextmenu.self="onCanvasContextMenu">

            <!-- Empty state -->
            <div v-if="!cards.length && !showAddPanel" class="empty-canvas" @contextmenu="onCanvasContextMenu">
                <div class="empty-grid">
                    <div class="empty-cell" v-for="i in 6" :key="i" />
                </div>
                <p class="empty-title">Your board is empty</p>
                <p class="empty-sub">Right-click anywhere to add links, notes, and images — then drag them freely.</p>
                <div class="empty-actions">
                    <button class="empty-btn" @click="openAdd('link')">+ Link</button>
                    <button class="empty-btn" @click="openAdd('note')">+ Note</button>
                    <button class="empty-btn" @click="openAdd('doc')">+ Document</button>
                    <button class="empty-btn" @click="triggerImagePick">+ Image</button>
                </div>
            </div>

            <!-- Free canvas -->
            <div v-else ref="canvasEl" class="free-canvas"
                :style="{ width: canvasSize().width + 'px', height: canvasSize().height + 'px' }"
                @contextmenu="onCanvasContextMenu">

                <div v-for="card in cards" :key="card.id" class="card-pos"
                    :style="{ left: (card.x ?? 0) + 'px', top: (card.y ?? 0) + 'px' }"
                    :class="{ dragging: dragging?.id === card.id }" @pointerdown="onCardPointerDown($event, card)"
                    @dblclick="openExpanded(card)">

                    <!-- ── Link card ── -->
                    <div v-if="card.type === 'link'" class="card link-card">
                        <div class="card-drag-handle">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <circle cx="9" cy="5" r="1" />
                                <circle cx="15" cy="5" r="1" />
                                <circle cx="9" cy="12" r="1" />
                                <circle cx="15" cy="12" r="1" />
                                <circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="19" r="1" />
                            </svg>
                        </div>
                        <button class="card-del" @click="removeCard(card.id)" title="Remove">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="3">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        <!-- Twitter/X embed -->
                        <template v-if="card.embed?.type === 'twitter'">
                            <div class="tweet-wrap">
                                <div v-if="card.tweetHtml" v-html="card.tweetHtml" class="tweet-html" />
                                <div v-else class="tweet-fallback">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DA1F2">
                                        <path
                                            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                    <a :href="card.url" target="_blank" rel="noopener" class="tweet-link">View on X
                                        →</a>
                                </div>
                            </div>
                            <div class="link-footer">
                                <span class="link-domain">x.com</span>
                                <a :href="card.url" target="_blank" rel="noopener" class="link-ext">Open ↗</a>
                            </div>
                        </template>

                        <!-- YouTube — crisp thumbnail card like Image 1 -->
                        <template v-else-if="card.embed?.type === 'youtube'">
                            <a :href="card.url" target="_blank" rel="noopener" class="yt-thumb-link">
                                <div class="yt-thumb-wrap">
                                    <!-- Try maxresdefault first, fall back to hqdefault -->
                                    <img :src="card.embed.thumbMax || card.ogImage" class="yt-thumb-img"
                                        :alt="card.title" loading="lazy"
                                        @error="e => { e.target.src = card.embed.thumbHq }" />
                                    <!-- YouTube-style play badge (top-right) -->
                                    <div class="yt-play-badge">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                            <polygon points="5,3 19,12 5,21" />
                                        </svg>
                                    </div>
                                    <!-- YT logo bottom-right -->
                                    <div class="yt-logo-badge">
                                        <svg width="16" height="11" viewBox="0 0 90 63" fill="none">
                                            <rect width="90" height="63" rx="13" fill="#FF0000" />
                                            <polygon points="37,18 37,45 61,31.5" fill="white" />
                                        </svg>
                                    </div>
                                </div>
                                <div class="yt-info">
                                    <p class="yt-title">{{ card.title }}</p>
                                    <span class="yt-channel">{{ card.domain }}</span>
                                </div>
                            </a>
                        </template>

                        <!-- Regular link — card preview + "View Site" button -->
                        <template v-else>
                            <div class="link-img-wrap" v-if="card.ogImage">
                                <img :src="card.ogImage" class="link-img" alt=""
                                    @error="e => e.target.parentElement.style.display = 'none'" loading="lazy" />
                            </div>
                            <div class="link-body">
                                <div class="link-meta-row">
                                    <img v-if="card.favicon" :src="card.favicon" class="favicon" alt=""
                                        @error="e => e.target.style.display = 'none'" />
                                    <span class="link-domain">{{ card.domain }}</span>
                                </div>
                                <p class="link-title">{{ card.title }}</p>
                                <p v-if="card.desc" class="link-desc">{{ card.desc }}</p>
                            </div>
                            <div class="link-footer">
                                <button class="view-site-btn" @click="openExpanded(card)">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <rect x="2" y="3" width="20" height="14" rx="2" />
                                        <line x1="8" y1="21" x2="16" y2="21" />
                                        <line x1="12" y1="17" x2="12" y2="21" />
                                    </svg>
                                    View Site
                                </button>
                                <a :href="card.url" target="_blank" rel="noopener" class="link-ext">Open ↗</a>
                            </div>
                        </template>
                    </div>

                    <!-- ── Note card ── -->
                    <div v-else-if="card.type === 'note'" class="card note-card"
                        :style="{ background: noteColorCfg(card.color).bg, borderColor: noteColorCfg(card.color).border, color: noteColorCfg(card.color).text }"
                        @contextmenu.stop="onCardContextMenu($event, card)">
                        <div class="card-drag-handle">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <circle cx="9" cy="5" r="1" />
                                <circle cx="15" cy="5" r="1" />
                                <circle cx="9" cy="12" r="1" />
                                <circle cx="15" cy="12" r="1" />
                                <circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="19" r="1" />
                            </svg>
                        </div>
                        <button class="card-del note-del" @click="removeCard(card.id)" title="Remove">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="3">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <textarea v-if="editingId === card.id" class="note-edit"
                            :style="{ color: noteColorCfg(card.color).text }" v-model="editingText"
                            @blur="commitEdit(card)" @keydown.ctrl.enter="commitEdit(card)" autofocus />
                        <p v-else class="note-text" @click="startEdit(card)">{{ card.text }}</p>
                    </div>

                    <!-- ── Image card ── -->
                    <div v-else-if="card.type === 'image'" class="card image-card">
                        <div class="card-drag-handle">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <circle cx="9" cy="5" r="1" />
                                <circle cx="15" cy="5" r="1" />
                                <circle cx="9" cy="12" r="1" />
                                <circle cx="15" cy="12" r="1" />
                                <circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="19" r="1" />
                            </svg>
                        </div>
                        <button class="card-del" @click="removeCard(card.id)" title="Remove">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="3">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <img :src="card.src" class="image-full" :alt="card.caption || card.name" />
                        <input class="image-caption-input" :value="card.caption"
                            @input="e => updateCaption(card, e.target.value)" placeholder="Add a caption…" />
                    </div>

                    <!-- ── Document card ── -->
                    <div v-else-if="card.type === 'doc'" class="card doc-card">
                        <div class="card-drag-handle">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <circle cx="9" cy="5" r="1" />
                                <circle cx="15" cy="5" r="1" />
                                <circle cx="9" cy="12" r="1" />
                                <circle cx="15" cy="12" r="1" />
                                <circle cx="9" cy="19" r="1" />
                                <circle cx="15" cy="19" r="1" />
                            </svg>
                        </div>
                        <button class="card-del" @click="removeCard(card.id)" title="Remove">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="3">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <div class="doc-card-head">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1"
                                stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span class="doc-card-label">Document</span>
                        </div>
                        <p class="doc-card-title">{{ card.title }}</p>
                        <p v-if="docSnippet(card.body)" class="doc-card-snippet">{{ docSnippet(card.body) }}</p>
                        <p v-else class="doc-card-empty">Empty document</p>
                        <div class="doc-card-footer">
                            <button class="doc-open-btn" @click.stop="openExpanded(card)">Open editor</button>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <!-- ── Link-adding loading toast ──────────────────────────────────────── -->
        <Transition name="link-toast">
            <div v-if="linkLoading" class="link-toast">
                <span class="link-toast-spinner" />
                <div class="link-toast-body">
                    <span class="link-toast-title">Adding link to board…</span>
                    <span v-if="linkLoadingUrl" class="link-toast-url">{{ linkLoadingUrl }}</span>
                </div>
            </div>
        </Transition>

        <!-- ── Right-click context menu ───────────────────────────────────────── -->
        <Transition name="ctx">
            <div v-if="contextMenu.visible" class="ctx-menu" :style="{
                left: contextMenu.x + 'px',
                top: contextMenu.y + 'px'
            }" @click.stop>
                <div class="ctx-label">Add to Board</div>
                <button class="ctx-item" @click="ctxPasteLink">
  <vue-feather type="link" size="13" /> Add Link
</button>
<button class="ctx-item" @click="ctxCreateNote">
  <vue-feather type="edit-3" size="13" /> Add Note
</button>
<button class="ctx-item" @click="ctxCreateDoc">
  <vue-feather type="file-text" size="13" /> Add Document
</button>
<button class="ctx-item" @click="ctxAddImage">
  <vue-feather type="image" size="13" /> Add Image
</button>
            </div>
        </Transition>
        <!-- ── Card right-click context menu ─────────────────────────────────────── -->
        <Transition name="ctx">
            <div v-if="cardContextMenu.visible" class="ctx-menu"
                :style="{ left: cardContextMenu.x + 'px', top: cardContextMenu.y + 'px' }" @click.stop>
                <div class="ctx-label">Note</div>
                <button class="ctx-item" @click="ctxEditNote">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit Note
                </button>
                <button class="ctx-item ctx-item--muted" @click="ctxDeleteCard">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Delete Note
                </button>
            </div>
        </Transition>

        <!-- ── Detail panel (double-click any card) ──────────────────────────── -->
        <Transition name="viewer">
            <div v-if="expandedCard" class="detail-overlay" @click.self="closeExpanded">
                <div class="detail-shell">

                    <!-- ════ YOUTUBE ════ -->
                    <template v-if="expandedCard.type === 'link' && expandedCard.embed?.type === 'youtube'">
                        <div class="detail-yt-player">
                            <iframe :src="`https://www.youtube.com/embed/${expandedCard.embed.vid}?autoplay=1`"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowfullscreen class="detail-yt-iframe" />
                        </div>
                        <div class="detail-body">
                            <div class="detail-topbar">
                                <div class="detail-meta-left">
                                    <img v-if="expandedCard.favicon" :src="expandedCard.favicon" class="detail-favicon"
                                        alt="" />
                                    <div>
                                        <p class="detail-channel">{{ expandedCard.domain }}</p>
                                    </div>
                                </div>
                                <div class="detail-actions">
                                    <a :href="expandedCard.url" target="_blank" rel="noopener"
                                        class="detail-open-btn">Watch on YouTube ↗</a>
                                    <button class="detail-close-btn" @click="closeExpanded">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" stroke-width="2.5">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <h1 class="detail-title">{{ expandedCard.title }}</h1>
                            <div class="detail-divider" />
                            <div class="detail-section-label">DESCRIPTION</div>
                            <p class="detail-desc-text">{{ expandedCard.desc || 'No description available.' }}</p>
                        </div>
                    </template>

                    <!-- ════ REGULAR LINK (iframe viewer) ════ -->
                    <template v-else-if="expandedCard.type === 'link'">
                        <div class="detail-link-topbar">
                            <div class="detail-meta-left">
                                <img v-if="expandedCard.favicon" :src="expandedCard.favicon" class="detail-favicon"
                                    alt="" />
                                <div>
                                    <p class="detail-channel">{{ expandedCard.domain }}</p>
                                </div>
                            </div>
                            <div class="detail-actions">
                                <a :href="expandedCard.url" target="_blank" rel="noopener" class="detail-open-btn">
                                    Open original ↗
                                </a>
                                <button class="detail-close-btn" @click="closeExpanded">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- iframe viewer -->
                        <div class="detail-iframe-wrap">
                            <iframe v-if="!iframeBlocked" :src="expandedCard.url" class="detail-iframe"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                referrerpolicy="no-referrer" @error="iframeBlocked = true" />
                            <!-- Blocked fallback -->
                            <div v-else class="reader-loading">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db"
                                    stroke-width="1.5">
                                    <rect x="2" y="3" width="20" height="14" rx="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                                <p>This site can't be embedded.</p>
                                <a :href="expandedCard.url" target="_blank" rel="noopener" class="detail-open-btn">
                                    Open in browser ↗
                                </a>
                            </div>
                        </div>
                    </template>
                    <!-- ════ NOTE ════ -->
                    <template v-else-if="expandedCard.type === 'note'">
                        <div class="detail-link-topbar">
                            <div class="detail-meta-left">
                                <div class="detail-note-dot"
                                    :style="{ background: noteColorCfg(expandedCard.color).border }" />
                                <p class="detail-channel">Note</p>
                            </div>
                            <div class="detail-actions">
                                <button class="detail-close-btn" @click="closeExpanded">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="detail-note-wrap"
                            :style="{ background: noteColorCfg(expandedCard.color).bg, color: noteColorCfg(expandedCard.color).text }">
                            <pre class="detail-note-text">{{ expandedCard.text }}</pre>
                        </div>
                    </template>

                    <!-- ════ IMAGE ════ -->
                    <template v-else-if="expandedCard.type === 'image'">
                        <div class="detail-link-topbar">
                            <div class="detail-meta-left">
                                <p class="detail-channel">{{ expandedCard.name }}</p>
                            </div>
                            <div class="detail-actions">
                                <button class="detail-close-btn" @click="closeExpanded">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="detail-image-wrap">
                            <img :src="expandedCard.src" class="detail-image-full"
                                :alt="expandedCard.caption || expandedCard.name" />
                            <p v-if="expandedCard.caption" class="detail-image-caption">{{ expandedCard.caption }}</p>
                        </div>
                    </template>

                    <!-- ════ DOCUMENT ════ -->
                    <template v-else-if="expandedCard.type === 'doc'">
                        <div class="detail-link-topbar">
                            <div class="detail-meta-left">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1"
                                    stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <p class="detail-channel">Document</p>
                            </div>
                            <div class="detail-actions">
                                <span v-if="saving" class="saving-indicator">Saving…</span>
                                <button class="detail-open-btn" @click="saveDocEdits">Save</button>
                                <button class="detail-close-btn" @click="closeExpanded">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="detail-doc-wrap">
                            <input v-model="docEditTitle" class="detail-doc-title" placeholder="Untitled document"
                                @blur="saveDocEdits" />
                            <textarea v-model="docEditBody" class="detail-doc-body" placeholder="Start writing…"
                                @blur="saveDocEdits" />
                        </div>
                    </template>

                </div>
            </div>
        </Transition>



    </div>
</template>

<style scoped>
/* ── Board shell ────────────────────────────────────────────────────────────── */
.eden-board {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #f3f4f6;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ── Side nav ────────────────────────────────────────────────────────────────── */
.sidenav-overlay {
    position: fixed;
    inset: 0;
    z-index: 800;
    background: rgba(17, 24, 39, 0.4);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: stretch;
}

.sidenav {
    width: 272px;
    height: 100%;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    box-shadow: 6px 0 32px rgba(0, 0, 0, 0.14);
    overflow-y: auto;
    overflow-x: hidden;
}

/* ── Sidenav header ──────────────────────────────────────────────────────────── */
.sidenav-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 16px 14px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
}

.sidenav-app-name {
    font-size: 15px;
    font-weight: 800;
    color: #111827;
    flex: 1;
    letter-spacing: -0.02em;
}

.sidenav-close {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid #e5e7eb;
    background: none;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
}

.sidenav-close:hover {
    background: #fef2f2;
    color: #ef4444;
    border-color: #fca5a5;
}

/* ── Section labels ──────────────────────────────────────────────────────────── */
.sidenav-section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #b0b8c8;
    padding: 18px 18px 7px;
}

/* ── Nav items ───────────────────────────────────────────────────────────────── */
.sidenav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: calc(100% - 16px);
    margin: 0 8px 1px;
    padding: 9px 12px;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    text-align: left;
    border-radius: 10px;
    transition: background 0.12s, color 0.12s;
    position: relative;
}

.sidenav-item svg {
    flex-shrink: 0;
    transition: stroke 0.12s;
}

.sidenav-item:hover {
    background: #f5f3ff;
    color: #6366f1;
}

.sidenav-item:hover svg {
    stroke: #6366f1;
}

/* Active = top-level current page (Idea Board) */
.sidenav-item--active {
    background: #ede9fe;
    color: #4f46e5;
    font-weight: 700;
}

.sidenav-item--active svg {
    stroke: #4f46e5;
}

/* Sub-active = current subfolder inside the folder */
.sidenav-item--sub-active {
    background: #f5f3ff;
    color: #6366f1;
    font-weight: 600;
}

.sidenav-item--sub-active svg {
    stroke: #6366f1;
}

/* Colored left bar for active item */
.sidenav-item--active::before,
.sidenav-item--sub-active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: #6366f1;
}

.sidenav-active-dot {
    margin-left: auto;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6366f1;
    flex-shrink: 0;
}

/* ── Subfolder navigation ───────────────────────────────────────────────────── */
.sidenav-subfolder-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sidenav-chevron {
    margin-left: auto;
    color: #d1d5db;
    flex-shrink: 0;
    opacity: 0;
    transform: translateX(-2px);
    transition: opacity 0.12s, transform 0.12s, stroke 0.12s;
}

.sidenav-subfolder:hover .sidenav-chevron {
    opacity: 1;
    transform: translateX(0);
    stroke: #6366f1;
}

.sidenav-empty-folder {
    font-size: 12px;
    color: #c4c9d4;
    font-style: italic;
    padding: 10px 14px;
    margin: 0;
}

/* ── Folder block ────────────────────────────────────────────────────────────── */
.sidenav-folder-block {
    margin: 4px 8px;
    background: #f9fafb;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    padding: 6px 0;
    overflow: hidden;
}

/* Items inside the folder block: tighter, no outer margin */
.sidenav-folder-block .sidenav-item {
    width: 100%;
    margin: 0;
    border-radius: 0;
    font-size: 13px;
    padding: 8px 14px;
}

.sidenav-folder-block .sidenav-item:first-child {
    border-radius: 10px 10px 0 0;
}

.sidenav-folder-block .sidenav-item:last-child {
    border-radius: 0 0 10px 10px;
}

.sidenav-folder-block .sidenav-item:only-child {
    border-radius: 10px;
}

.sidenav-folder-block .sidenav-item--active::before,
.sidenav-folder-block .sidenav-item--sub-active::before {
    left: 0;
    border-radius: 0 3px 3px 0;
}

/* ── Divider ─────────────────────────────────────────────────────────────────── */
.sidenav-divider {
    height: 1px;
    background: #f3f4f6;
    margin: 10px 18px;
}

/* ── Popup modal ────────────────────────────────────────────────── */
.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 700;
    background: rgba(17, 24, 39, 0.45);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.modal-card {
    width: 100%;
    max-width: 440px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    padding: 20px 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.modal-head {
    display: flex;
    align-items: center;
    gap: 9px;
}

.modal-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    flex: 1;
}

.modal-x {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    border: 1px solid #e5e7eb;
    background: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 13px;
}

.modal-x:hover {
    background: #fef2f2;
    color: #ef4444;
    border-color: #fca5a5;
}

.modal-sub {
    font-size: 12px;
    color: #9ca3af;
    margin: -4px 0 0;
}

.modal-input {
    border: 1.5px solid #e5e7eb;
    border-radius: 9px;
    padding: 10px 13px;
    font-family: inherit;
    font-size: 14px;
    color: #111827;
    outline: none;
    background: #f9fafb;
    transition: border-color 0.15s, background 0.15s;
}

.modal-input:focus {
    border-color: #6366f1;
    background: #fff;
}

.modal-textarea {
    border: 1.5px solid #e5e7eb;
    border-radius: 9px;
    padding: 12px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    outline: none;
    resize: vertical;
    min-height: 110px;
    box-sizing: border-box;
    transition: border-color 0.15s;
}

.modal-textarea:focus {
    border-color: #6366f1;
}

.modal-pills {
    margin-left: 0;
}

.modal-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.modal-enter-active {
    animation: modalIn 0.18s ease;
}

.modal-leave-active {
    animation: modalIn 0.15s ease reverse;
}

@keyframes modalIn {
    from {
        opacity: 0;
        transform: scale(0.96);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* ── Footer ──────────────────────────────────────────────────────────────────── */
.sidenav-footer {
    padding: 14px 18px;
    font-size: 11px;
    color: #d1d5db;
    margin-top: auto;
    border-top: 1px solid #f3f4f6;
}

/* ── Side nav transition ────────────────────────────────────────────────────── */
.sidenav-enter-active {
    animation: overlayFadeIn 0.22s ease forwards;
}

.sidenav-leave-active {
    animation: overlayFadeIn 0.18s ease reverse forwards;
}

@keyframes overlayFadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

.sidenav-enter-active .sidenav {
    animation: slideNavPanel 0.24s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.sidenav-leave-active .sidenav {
    animation: slideNavPanel 0.18s ease reverse forwards;
}

@keyframes slideNavPanel {
    from {
        transform: translateX(-100%);
        opacity: 0.6;
    }

    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* ── Nav bar ────────────────────────────────────────────────────────────────── */
.board-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px 0 10px;
    height: 48px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
}

/* ── Hamburger button ───────────────────────────────────────────────────────── */
.hamburger-btn {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    border: 1px solid #e5e7eb;
    background: #fff;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4.5px;
    flex-shrink: 0;
    transition: all 0.15s;
    padding: 0;
}

.detail-iframe-wrap {
    flex: 1;
    overflow: hidden;
    background: #f9fafb;
    display: flex;
    flex-direction: column;
}

.detail-iframe {
    width: 100%;
    height: 100%;
    border: none;
    flex: 1;
    display: block;
    background: #fff;
}

.hamburger-btn:hover {
    border-color: #6366f1;
    background: #f5f3ff;
}

.hamburger-btn:hover .ham-line {
    background: #6366f1;
}

.hamburger-btn.open {
    border-color: #6366f1;
    background: #f5f3ff;
}

.hamburger-btn.open .ham-line {
    background: #6366f1;
}

.ham-line {
    display: block;
    width: 16px;
    height: 1.8px;
    border-radius: 2px;
    background: #6b7280;
    transition: all 0.2s;
}

/* Animate to X when open */
.hamburger-btn.open .ham-line:nth-child(1) {
    transform: translateY(6.3px) rotate(45deg);
}

.hamburger-btn.open .ham-line:nth-child(2) {
    opacity: 0;
    transform: scaleX(0);
}

.hamburger-btn.open .ham-line:nth-child(3) {
    transform: translateY(-6.3px) rotate(-45deg);
}

/* ── Breadcrumb ─────────────────────────────────────────────────────────────── */
.board-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    overflow: hidden;
}

.bread-home {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: none;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
    padding: 0;
}

.bread-home:hover {
    background: #f3f4f6;
    color: #374151;
}

.bread-folder {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
}

.bread-current {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.board-nav-right {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
}

.saving-indicator {
    font-size: 12px;
    color: #9ca3af;
}

.card-count {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
}

.toolbar-hint {
    font-size: 12px;
    color: #d1d5db;
}

.hidden-input {
    display: none;
}

/* ── Add panel ──────────────────────────────────────────────────────────────── */
.add-panel {
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    padding: 14px 20px;
    flex-shrink: 0;
}

.panel-inner {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
}

.panel-hint-small {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 400;
}

.panel-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.note-row {
    align-items: flex-start;
}

.panel-input {
    flex: 1;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 13px;
    color: #111827;
    outline: none;
    transition: border-color 0.15s;
    background: #f9fafb;
}

.panel-input:focus {
    border-color: #6366f1;
    background: #fff;
}

.panel-textarea {
    flex: 1;
    width: 100%;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.6;
    outline: none;
    resize: vertical;
    min-height: 90px;
    transition: border-color 0.15s;
    box-sizing: border-box;
}

.panel-textarea:focus {
    border-color: #6366f1;
}

.panel-submit {
    padding: 8px 16px;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.panel-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.panel-submit:not(:disabled):hover {
    background: #4f46e5;
}

.panel-cancel {
    padding: 8px 12px;
    background: none;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
    font-family: inherit;
}

.panel-cancel:hover {
    border-color: #9ca3af;
    color: #374151;
}

.panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.panel-hint {
    font-size: 11px;
    color: #9ca3af;
}

.panel-btns {
    display: flex;
    gap: 8px;
}

.panel-error {
    font-size: 12px;
    color: #ef4444;
    margin: 0;
}

.color-pills {
    display: flex;
    gap: 5px;
    margin-left: 8px;
}

.color-pill {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.12s;
}

.color-pill:hover {
    transform: scale(1.2);
}

.color-pill.active {
    border-color: #6366f1 !important;
    transform: scale(1.15);
}

.panel-enter-active {
    animation: slideDown 0.18s ease;
}

.panel-leave-active {
    animation: slideDown 0.15s ease reverse;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.mini-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Link-adding loading toast ──────────────────────────────────────────────── */
.link-toast {
    position: fixed;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    background: #111827;
    color: #fff;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
    max-width: 360px;
}

.link-toast-spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255, 255, 255, 0.25);
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
}

.link-toast-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
}

.link-toast-title {
    font-size: 13px;
    font-weight: 600;
}

.link-toast-url {
    font-size: 11px;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
}

.link-toast-enter-active {
    animation: toastIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.link-toast-leave-active {
    animation: toastIn 0.16s ease reverse;
}

@keyframes toastIn {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(14px);
    }

    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

/* ── Canvas scroll area ─────────────────────────────────────────────────────── */
.canvas-scroll {
    flex: 1;
    overflow: auto;
    position: relative;
}

/* ── Empty state ────────────────────────────────────────────────────────────── */
.empty-canvas {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    padding: 40px;
}

.empty-grid {
    display: grid;
    grid-template-columns: repeat(3, 48px);
    grid-template-rows: repeat(2, 48px);
    gap: 6px;
    margin-bottom: 8px;
    opacity: 0.15;
}

.empty-cell {
    background: #9ca3af;
    border-radius: 6px;
}

.empty-title {
    font-size: 16px;
    font-weight: 700;
    color: #374151;
    margin: 0;
}

.empty-sub {
    font-size: 13px;
    color: #9ca3af;
    line-height: 1.6;
    max-width: 340px;
    margin: 0;
}

.empty-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.empty-btn {
    padding: 7px 16px;
    border-radius: 8px;
    border: 1.5px solid #e5e7eb;
    background: #fff;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
}

.empty-btn:hover {
    border-color: #6366f1;
    color: #6366f1;
    background: #f5f3ff;
}

/* ── Free canvas ────────────────────────────────────────────────────────────── */
.free-canvas {
    position: relative;
    min-width: 100%;
    min-height: 100%;
}

/* ── Card positioned wrapper ────────────────────────────────────────────────── */
.card-pos {
    position: absolute;
    width: 280px;
    user-select: none;
    transition: box-shadow 0.15s ease;
}

.card-pos.dragging {
    z-index: 999;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.card-pos:hover {
    z-index: 10;
}

/* ── Drag handle ────────────────────────────────────────────────────────────── */
.card-drag-handle {
    position: absolute;
    top: 6px;
    left: 8px;
    color: #d1d5db;
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 3;
    display: flex;
    align-items: center;
}

.card-pos:hover .card-drag-handle {
    opacity: 1;
}

.card-pos.dragging .card-drag-handle {
    cursor: grabbing;
}

/* ── Base card ──────────────────────────────────────────────────────────────── */
.card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: box-shadow 0.2s ease;
    width: 100%;
}

.card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.card-del {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.06);
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    z-index: 4;
}

.card:hover .card-del {
    opacity: 1;
}

.card-del:hover {
    background: #fef2f2;
    color: #ef4444;
}

.note-del {
    background: rgba(0, 0, 0, 0.08);
}

/* ── Twitter embed ──────────────────────────────────────────────────────────── */
.tweet-wrap {
    padding: 12px;
    min-height: 80px;
}

.tweet-html {
    font-size: 13px;
    line-height: 1.5;
}

.tweet-html :deep(.twitter-tweet) {
    margin: 0 !important;
}

.tweet-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    text-align: center;
}

.tweet-link {
    font-size: 13px;
    font-weight: 600;
    color: #1DA1F2;
    text-decoration: none;
}

.tweet-link:hover {
    text-decoration: underline;
}

/* ── Link card ──────────────────────────────────────────────────────────────── */
.link-img-wrap {
    width: 100%;
    max-height: 160px;
    overflow: hidden;
    background: #f3f4f6;
}

.link-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
}

.link-body {
    padding: 12px 14px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.link-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.favicon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
}

.link-domain {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: lowercase;
}

.link-title {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.link-desc {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.link-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 10px;
    border-top: 1px solid #f3f4f6;
    gap: 8px;
}

.view-site-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 11px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
}

.view-site-btn:hover {
    border-color: #6366f1;
    color: #6366f1;
    background: #f5f3ff;
}

.link-ext {
    font-size: 11px;
    font-weight: 700;
    color: #6366f1;
    text-decoration: none;
    flex-shrink: 0;
}

.link-ext:hover {
    text-decoration: underline;
}

/* ── YouTube thumbnail card ──────────────────────────────────────────────────── */
.yt-thumb-link {
    display: block;
    text-decoration: none;
    color: inherit;
}

.yt-thumb-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    overflow: hidden;
    background: #0f0f0f;
}

.yt-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
}

.yt-thumb-link:hover .yt-thumb-img {
    transform: scale(1.03);
}

/* Play badge — top right, like YouTube's own UI */
.yt-play-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

/* YouTube logo — bottom right */
.yt-logo-badge {
    position: absolute;
    bottom: 8px;
    right: 10px;
    opacity: 0.92;
}

.yt-info {
    padding: 10px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.yt-title {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.yt-channel {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 500;
}

/* ── Note card ──────────────────────────────────────────────────────────────── */
.note-card {
    padding: 20px 16px 16px;
    min-height: 80px;
    border-width: 1.5px;
}

.note-text {
    font-size: 14px;
    line-height: 1.7;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    cursor: text;
    padding-top: 4px;
}

.note-edit {
    width: 100%;
    min-height: 80px;
    background: transparent;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.7;
    resize: none;
    box-sizing: border-box;
    color: inherit;
    padding-top: 4px;
}

/* ── Image card ─────────────────────────────────────────────────────────────── */
.image-full {
    width: 100%;
    display: block;
    object-fit: cover;
}

.image-caption-input {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
    font-family: inherit;
    font-size: 12px;
    color: #6b7280;
    outline: none;
    box-sizing: border-box;
}

.image-caption-input::placeholder {
    color: #d1d5db;
}

/* ── Document card ──────────────────────────────────────────────────────────── */
.doc-card {
    padding: 16px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 120px;
    cursor: pointer;
}

.doc-card-head {
    display: flex;
    align-items: center;
    gap: 6px;
}

.doc-card-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9ca3af;
}

.doc-card-title {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.doc-card-snippet {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.6;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.doc-card-empty {
    font-size: 12px;
    color: #d1d5db;
    font-style: italic;
    margin: 0;
}

.doc-card-footer {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #f3f4f6;
}

.doc-open-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 11px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
}

.doc-open-btn:hover {
    border-color: #6366f1;
    color: #6366f1;
    background: #f5f3ff;
}

/* ── Document modal sizing ──────────────────────────────────────────────────── */
.modal-card--doc {
    max-width: 560px;
}

.doc-title-input {
    font-size: 16px;
    font-weight: 700;
}

.doc-body-input {
    min-height: 220px;
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.7;
}

/* ── Document editor (detail overlay) ───────────────────────────────────────── */
.detail-doc-wrap {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 28px 48px 48px;
    max-width: 820px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
}

.detail-doc-title {
    border: none;
    outline: none;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 28px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 16px;
    background: transparent;
    width: 100%;
}

.detail-doc-title::placeholder {
    color: #d1d5db;
}

.detail-doc-body {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    line-height: 1.85;
    color: #1a1a1a;
    background: transparent;
    width: 100%;
    min-height: 400px;
}

.detail-doc-body::placeholder {
    color: #d1d5db;
}

/* ── Context menu ───────────────────────────────────────────────────────────── */
.ctx-menu {
    position: fixed;
    z-index: 9999;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    min-width: 180px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.ctx-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9ca3af;
    padding: 4px 10px 6px;
}

.ctx-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border-radius: 7px;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: #111827;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    width: 100%;
}

.ctx-item:hover {
    background: #f3f4f6;
}

.ctx-item:hover svg {
    stroke: #6366f1;
}

.ctx-item--muted {
    color: #9ca3af;
}

.ctx-item--muted:hover {
    background: #fef2f2;
    color: #ef4444;
}

.ctx-item--muted:hover svg {
    stroke: #ef4444;
}

.ctx-divider {
    height: 1px;
    background: #f3f4f6;
    margin: 4px 0;
}

.ctx-enter-active {
    animation: ctxIn 0.12s ease;
}

.ctx-leave-active {
    animation: ctxIn 0.1s ease reverse;
}

@keyframes ctxIn {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(-4px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* ── Detail overlay ──────────────────────────────────────────────────────────── */
.detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
}

.detail-shell {
    width: 100%;
    max-width: 900px;
    height: 100%;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.25);
}

/* ── YouTube player area ──────────────────────────────────────────────────── */
.detail-yt-player {
    width: 100%;
    aspect-ratio: 16/9;
    background: #000;
    flex-shrink: 0;
}

.detail-yt-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}

/* ── Shared topbars ──────────────────────────────────────────────────────── */
.detail-topbar,
.detail-link-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    gap: 12px;
}

.detail-meta-left {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
}

.detail-favicon {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
}

.detail-note-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}

.detail-channel {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.detail-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.detail-open-btn {
    display: inline-flex;
    align-items: center;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #fff;
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    white-space: nowrap;
}

.detail-open-btn:hover {
    background: #f5f3ff;
    border-color: #6366f1;
}

.detail-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
}

.detail-close-btn:hover {
    background: #fef2f2;
    color: #ef4444;
    border-color: #fca5a5;
}

/* ── YouTube body (below player) ─────────────────────────────────────────── */
.detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 28px 40px;
}

.detail-title {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    line-height: 1.35;
    margin: 4px 0 16px;
    font-family: system-ui, -apple-system, sans-serif;
}

.detail-divider {
    height: 1px;
    background: #f0f0f0;
    margin: 16px 0;
}

.detail-section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #9ca3af;
    text-transform: uppercase;
    margin-bottom: 10px;
}

.detail-desc-text {
    font-size: 14px;
    line-height: 1.75;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
}

/* ── Reader wrap ─────────────────────────────────────────────────────────── */
.detail-reader-wrap {
    flex: 1;
    overflow-y: auto;
    background: #fff;
}

/* ── Note detail ─────────────────────────────────────────────────────────── */
.detail-note-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 40px 48px;
}

.detail-note-text {
    font-family: Georgia, serif;
    font-size: 18px;
    line-height: 1.85;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    color: inherit;
}

/* ── Image detail ────────────────────────────────────────────────────────── */
.detail-image-wrap {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: #f9fafb;
    gap: 16px;
}

.detail-image-full {
    max-width: 100%;
    max-height: calc(100vh - 180px);
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.12);
}

.detail-image-caption {
    font-size: 13px;
    color: #6b7280;
    margin: 0;
    text-align: center;
}

/* ── Reader content typography ────────────────────────────────────────────── */
.reader-content {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 48px 80px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    line-height: 1.8;
    color: #1a1a1a;
}

.reader-content :deep(h1),
.reader-content :deep(h2),
.reader-content :deep(h3),
.reader-content :deep(h4) {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 700;
    line-height: 1.3;
    margin: 1.6em 0 0.5em;
    color: #111;
}

.reader-content :deep(h1) {
    font-size: 1.8em;
}

.reader-content :deep(h2) {
    font-size: 1.4em;
}

.reader-content :deep(h3) {
    font-size: 1.15em;
}

.reader-content :deep(p) {
    margin: 0 0 1.2em;
}

.reader-content :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 1.5em 0;
    display: block;
}

.reader-content :deep(a) {
    color: #6366f1;
    text-decoration: underline;
    text-underline-offset: 3px;
}

.reader-content :deep(a:hover) {
    color: #4f46e5;
}

.reader-content :deep(pre),
.reader-content :deep(code) {
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 0.88em;
    background: #f3f4f6;
    border-radius: 5px;
}

.reader-content :deep(pre) {
    padding: 16px 20px;
    overflow-x: auto;
    margin: 1.5em 0;
    border: 1px solid #e5e7eb;
}

.reader-content :deep(code) {
    padding: 2px 6px;
}

.reader-content :deep(pre code) {
    background: none;
    padding: 0;
}

.reader-content :deep(blockquote) {
    border-left: 4px solid #6366f1;
    margin: 1.5em 0;
    padding: 4px 0 4px 20px;
    color: #4b5563;
    font-style: italic;
}

.reader-content :deep(ul),
.reader-content :deep(ol) {
    margin: 0 0 1.2em 1.5em;
    padding: 0;
}

.reader-content :deep(li) {
    margin-bottom: 0.4em;
}

.reader-content :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5em 0;
    font-size: 0.9em;
}

.reader-content :deep(th),
.reader-content :deep(td) {
    border: 1px solid #e5e7eb;
    padding: 8px 12px;
    text-align: left;
}

.reader-content :deep(th) {
    background: #f9fafb;
    font-family: system-ui, sans-serif;
    font-weight: 700;
    font-size: 0.85em;
}

.reader-content :deep(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2em 0;
}

.reader-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    min-height: 300px;
    color: #9ca3af;
    text-align: center;
    padding: 40px;
}

.reader-loading p {
    font-size: 14px;
    margin: 0;
}

.viewer-enter-active {
    animation: viewerIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.viewer-leave-active {
    animation: viewerIn 0.18s ease reverse;
}

@keyframes viewerIn {
    from {
        opacity: 0;
        transform: translateX(40px);
    }

    to {
        opacity: 1;
        transform: translateX(0);
    }
}
</style>