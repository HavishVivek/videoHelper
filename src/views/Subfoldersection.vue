<script setup>
/**
 * SubfolderSection.vue — Google-Drive-style file storage
 * Top level: folders AND loose items together. Drive items can be
 * previewed in-app via Google's preview iframe (click card or right-click → Preview).
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import BaseButton from '@/components/ui/BaseButton.vue'
import { saveImage, getImageBlob, deleteImage, imageKey } from '@/services/imageStorage'
import VueFeather from 'vue-feather'
import { openDrivePicker } from '../api/drive.js'

const props = defineProps({
    ideaId: { type: String, required: true },
    folderName: { type: String, required: true },
})

const pickingDrive = ref(false)
const DRIVE_FOLDERS = ['scripts', 'docs', 'schematics', 'footage', 'audio', 'thumbnails', 'code']
const showDriveBtn = computed(() => DRIVE_FOLDERS.includes(props.folderName?.toLowerCase()))

function subfolderSchema(name) {
    const map = {
        schematics: { icon: 'cpu', label: 'Schematics', accept: 'image/*,.pdf', color: '#7C3AED' },
        mockups: { icon: 'pen-tool', label: 'Mockups', accept: 'image/*', color: '#DB2777' },
        renders: { icon: 'aperture', label: 'Renders', accept: 'image/*', color: '#D97706' },
        docs: { icon: 'file-text', label: 'Docs', accept: '.pdf,.docx,.md,.txt', color: '#2563EB' },
        assets: { icon: 'folder', label: 'Assets', accept: 'image/*,.pdf,.zip,.svg', color: '#059669' },
        code: { icon: 'code', label: 'Code', accept: null, color: '#475569' },
        research: { icon: 'search', label: 'Research', accept: null, color: '#0891B2' },
        references: { icon: 'book', label: 'References', accept: null, color: '#7C3AED' },
        notes: { icon: 'edit-3', label: 'Notes', accept: null, color: '#CA8A04' },
        thumbnails: { icon: 'image', label: 'Thumbnails', accept: 'image/*', color: '#DC2626' },
        clips: { icon: 'film', label: 'Clips', accept: 'video/*', color: '#7C3AED' },
        footage: { icon: 'video', label: 'Footage', accept: 'video/*', color: '#1D4ED8' },
        audio: { icon: 'mic', label: 'Audio', accept: 'audio/*', color: '#BE185D' },
        exports: { icon: 'package', label: 'Exports', accept: '*/*', color: '#374151' },
    }
    return map[name?.toLowerCase()] ?? { icon: 'folder', label: name ?? 'Files', accept: '*/*', color: '#6366f1' }
}

function onGlobalKeydown(e) {
    if (e.key === 'Escape') { closeCtxMenu(); closeDrivePreview(); closeLightbox() }
}

const ideasStore = useIdeasStore()
const schema = computed(() => subfolderSchema(props.folderName))
const idea = computed(() => ideasStore.ideas.find(i => i.id === props.ideaId) || null)

const nestedFoldersMap = computed(() => idea.value?.nestedFolders?.[props.folderName] || {})
const nestedFolders = computed(() =>
    Object.values(nestedFoldersMap.value).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
)
const looseItems = computed(() => idea.value?.subfolders?.[props.folderName] || [])

const openFolderId = ref(null)
const openFolder = computed(() => openFolderId.value ? nestedFoldersMap.value[openFolderId.value] : null)
const openFolderItems = computed(() => openFolder.value?.items || [])
const activeItems = computed(() => openFolderId.value ? openFolderItems.value : looseItems.value)

function enterFolder(id) { openFolderId.value = id; showItemForm.value = false; showGithubForm.value = false }
function exitFolder() { openFolderId.value = null }
watch(() => props.folderName, () => { openFolderId.value = null })

async function addItemHere(payload) {
    if (openFolderId.value) return await ideasStore.addNestedFolderItem(props.ideaId, props.folderName, openFolderId.value, payload)
    return await ideasStore.addSubfolderItem(props.ideaId, props.folderName, payload)
}
async function updateItemHere(itemId, updates) {
    if (openFolderId.value) return await ideasStore.updateNestedFolderItem(props.ideaId, props.folderName, openFolderId.value, itemId, updates)
    return await ideasStore.updateSubfolderItem(props.ideaId, props.folderName, itemId, updates)
}
async function deleteItemHere(itemId) {
    if (openFolderId.value) return await ideasStore.deleteNestedFolderItem(props.ideaId, props.folderName, openFolderId.value, itemId)
    return await ideasStore.deleteSubfolderItem(props.ideaId, props.folderName, itemId)
}
function itemKeyFor(itemId) {
    const scope = openFolderId.value || 'top'
    return imageKey(props.ideaId, `nf_${props.folderName}_${scope}_${itemId}`)
}

onMounted(() => {
    window.addEventListener('keydown', onGlobalKeydown)
    window.addEventListener('scroll', closeCtxMenu, true)
})
onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeydown)
    window.removeEventListener('scroll', closeCtxMenu, true)
})

const showCreateModal = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)
function openCreateModal() { newFolderName.value = ''; showCreateModal.value = true }
async function createNestedFolder() {
    const name = newFolderName.value.trim()
    if (!name) return
    creatingFolder.value = true
    try {
        const nf = await ideasStore.addNestedFolder(props.ideaId, props.folderName, name)
        showCreateModal.value = false
        if (nf?.id) enterFolder(nf.id)
    } finally { creatingFolder.value = false }
}

async function pickFromDrive() {
    pickingDrive.value = true
    try {
        const files = await openDrivePicker()
        for (const f of files) {
            await addItemHere({ title: f.name, driveId: f.id, driveUrl: f.url, driveMime: f.mimeType, driveIcon: f.iconUrl })
        }
    } catch (e) {
        if (e?.error !== 'popup_closed_by_user') { alert('Could not open Google Drive picker.'); console.error(e) }
    } finally { pickingDrive.value = false }
}

async function deleteNestedFolder(nf, e) {
    e.stopPropagation()
    if (!confirm(`Delete folder "${nf.name}" and all its files?`)) return
    for (const item of nf.items || []) {
        if (item.fileName) { try { await deleteImage(imageKey(props.ideaId, `nf_${props.folderName}_${nf.id}_${item.id}`)) } catch { } }
    }
    await ideasStore.deleteNestedFolder(props.ideaId, props.folderName, nf.id)
    if (openFolderId.value === nf.id) exitFolder()
}

const fileUrls = ref({})
const uploading = ref({})
const dragOver = ref(false)
function isDrive(item) { return !!item.driveUrl }

async function _saveFile(itemId, file) {
    uploading.value[itemId] = true
    try {
        if (fileUrls.value[itemId]) URL.revokeObjectURL(fileUrls.value[itemId])
        await saveImage(itemKeyFor(itemId), file)
        fileUrls.value[itemId] = URL.createObjectURL(file)
        await updateItemHere(itemId, { fileName: file.name, fileSize: file.size, fileType: file.type })
    } finally { uploading.value[itemId] = false }
}

async function loadBlobsForActive() {
    for (const item of activeItems.value) {
        if (!item.fileName || fileUrls.value[item.id]) continue
        try { const blob = await getImageBlob(itemKeyFor(item.id)); if (blob) fileUrls.value[item.id] = URL.createObjectURL(blob) } catch { }
    }
}
watch(openFolderId, loadBlobsForActive)
watch(looseItems, loadBlobsForActive, { immediate: true })

const fileInputRef = ref(null)
async function uploadFiles(fileList) {
    if (!fileList?.length) return
    for (const file of Array.from(fileList)) {
        const title = file.name.replace(/\.[^.]+$/, '')
        const newItem = await addItemHere({ title, notes: '' })
        if (newItem) await _saveFile(newItem.id, file)
    }
}
function onPickFiles(e) { uploadFiles(e.target.files); e.target.value = '' }
function onDrop(e) { e.preventDefault(); dragOver.value = false; uploadFiles(e.dataTransfer.files) }

const showItemForm = ref(false)
const itemForm = ref({ title: '', notes: '', link: '', snippet: '', language: 'javascript' })
const addingItem = ref(false)
function openItemForm() {
    itemForm.value = { title: '', notes: '', link: '', snippet: '', language: 'javascript' }
    showItemForm.value = true; showGithubForm.value = false
}
async function saveTextItem() {
    addingItem.value = true
    try {
        const payload = { title: itemForm.value.title.trim(), notes: itemForm.value.notes.trim() }
        if (itemForm.value.link) payload.link = itemForm.value.link.trim()
        if (itemForm.value.snippet) { payload.snippet = itemForm.value.snippet; payload.language = itemForm.value.language }
        await addItemHere(payload)
        showItemForm.value = false
    } finally { addingItem.value = false }
}

const showGithubForm = ref(false)
const githubUrl = ref('')
const addingGithub = ref(false)
function openGithubForm() { githubUrl.value = ''; showGithubForm.value = true; showItemForm.value = false }
function parseGithub(url) {
    try {
        const u = new URL(url.trim())
        if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
        const [owner, repo] = u.pathname.replace(/^\/+|\/+$/g, '').split('/')
        if (!owner || !repo) return null
        return { owner, repo: repo.replace(/\.git$/, '') }
    } catch { return null }
}
async function saveGithubLink() {
    const parsed = parseGithub(githubUrl.value)
    if (!parsed) { alert('Please paste a valid GitHub repo URL (https://github.com/owner/repo)'); return }
    addingGithub.value = true
    try {
        await addItemHere({ title: `${parsed.owner}/${parsed.repo}`, githubUrl: githubUrl.value.trim(), githubOwner: parsed.owner, githubRepo: parsed.repo })
        showGithubForm.value = false
    } finally { addingGithub.value = false }
}

async function removeFile(item) {
    if (!confirm(`Remove file "${item.fileName}"?`)) return
    await deleteImage(itemKeyFor(item.id))
    if (fileUrls.value[item.id]) { URL.revokeObjectURL(fileUrls.value[item.id]); delete fileUrls.value[item.id] }
    await updateItemHere(item.id, { fileName: null, fileSize: null, fileType: null })
}
async function removeItem(item) {
    if (!confirm('Delete this item?')) return
    if (item.fileName) {
        try { await deleteImage(itemKeyFor(item.id)) } catch { }
        if (fileUrls.value[item.id]) { URL.revokeObjectURL(fileUrls.value[item.id]); delete fileUrls.value[item.id] }
    }
    await deleteItemHere(item.id)
}

const lightboxItem = ref(null)
function openLightbox(item) {
    if (isDrive(item)) { openDrivePreview(item); return }
    if (fileUrls.value[item.id] && isImage(item)) lightboxItem.value = item
}
function closeLightbox() { lightboxItem.value = null }

const drivePreviewItem = ref(null)
function driveEmbedUrl(item) { return item?.driveId ? `https://drive.google.com/file/d/${item.driveId}/preview` : null }
function openDrivePreview(item) { if (item?.driveId) drivePreviewItem.value = item }
function closeDrivePreview() { drivePreviewItem.value = null }

const ctxMenu = ref({ visible: false, x: 0, y: 0, item: null })
function onContextMenu(e, item) {
    e.preventDefault()
    const menuW = 190, menuH = 140
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8)
    ctxMenu.value = { visible: true, x, y, item }
}
function closeCtxMenu() { ctxMenu.value.visible = false }

function ctxPreviewDrive() { const item = ctxMenu.value.item; closeCtxMenu(); if (item) openDrivePreview(item) }
async function ctxDeleteFile() { const item = ctxMenu.value.item; closeCtxMenu(); if (item) await removeFile(item) }
async function ctxDeleteItem() { const item = ctxMenu.value.item; closeCtxMenu(); if (item) await removeItem(item) }
async function ctxOpenLightbox() { const item = ctxMenu.value.item; closeCtxMenu(); if (item) openLightbox(item) }

const isFileType = computed(() => !['code', 'research', 'references', 'notes'].includes(props.folderName))
function isImage(item) { return item.fileType?.startsWith('image/') }
function isVideo(item) { return item.fileType?.startsWith('video/') }
function isPDF(item) { return item.fileType === 'application/pdf' || item.fileName?.endsWith('.pdf') }
function isGithub(item) { return !!item.githubUrl }
function fileExt(item) { if (!item.fileName) return ''; return item.fileName.split('.').pop().toUpperCase() }
function formatSize(b) { if (!b) return ''; return b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB` }
function fileColor(item) {
    if (isImage(item)) return '#059669'
    if (isVideo(item)) return '#7C3AED'
    if (isPDF(item)) return '#DC2626'
    const ext = fileExt(item)
    if (['DOC', 'DOCX'].includes(ext)) return '#2563EB'
    if (['ZIP', 'RAR'].includes(ext)) return '#D97706'
    if (['SVG'].includes(ext)) return '#DB2777'
    return '#475569'
}
</script>

<template>
    <div class="sf">
        <div class="sf-crumb">
            <button class="crumb-btn" :class="{ muted: !!openFolderId }" @click="exitFolder">
                <vue-feather :type="schema.icon" size="14" /> {{ schema.label }}
            </button>
            <template v-if="openFolder">
                <span class="crumb-sep">›</span>
                <span class="crumb-current">{{ openFolder.name }}</span>
            </template>
        </div>

        <div class="sf-toolbar">
            <p class="sf-hint">
                <template v-if="openFolder">{{ openFolderItems.length }} item{{ openFolderItems.length !== 1 ? 's' : ''
                }}</template>
                <template v-else>{{ nestedFolders.length }} folder{{ nestedFolders.length !== 1 ? 's' : '' }} · {{
                    looseItems.length }} item{{ looseItems.length !== 1 ? 's' : '' }}</template>
            </p>
            <div class="sf-toolbar-actions">
                <BaseButton v-if="!openFolderId" size="sm" variant="secondary" @click="openCreateModal">
                    <vue-feather type="plus" size="14" /> New Folder
                </BaseButton>
                <label v-if="isFileType" class="sf-upload-btn">
                    <input ref="fileInputRef" type="file" :accept="schema.accept" multiple class="sf-hidden-input"
                        @change="onPickFiles" />
                    <span class="btn-icon"><vue-feather type="upload" size="13" /></span> Upload
                </label>
                <BaseButton v-if="folderName === 'code'" size="sm" variant="secondary" @click="openGithubForm">
                    <vue-feather type="github" size="13" /> GitHub
                </BaseButton>
                <BaseButton v-if="showDriveBtn" size="sm" variant="secondary" @click="pickFromDrive"
                    :disabled="pickingDrive">
                    <vue-feather type="hard-drive" size="13" />
                    {{ pickingDrive ? 'Opening…' : 'Add from Drive' }}
                </BaseButton>
                <BaseButton v-if="!isFileType" size="sm" @click="openItemForm">+ Add Item</BaseButton>
            </div>
        </div>

        <div v-if="showGithubForm" class="sf-item-form">
            <label class="sf-label">GitHub Repo URL</label>
            <input v-model="githubUrl" class="sf-input" placeholder="https://github.com/owner/repo"
                @keydown.enter="saveGithubLink" autofocus />
            <div class="sf-form-actions">
                <BaseButton size="sm" variant="secondary" @click="showGithubForm = false">Cancel</BaseButton>
                <BaseButton size="sm" @click="saveGithubLink" :disabled="addingGithub">{{ addingGithub ? 'Saving…' :
                    'Save' }}
                </BaseButton>
            </div>
        </div>

        <div v-if="showItemForm" class="sf-item-form">
            <label class="sf-label">Title</label>
            <input v-model="itemForm.title" class="sf-input" placeholder="Name…" />
            <template v-if="folderName === 'research' || folderName === 'references'">
                <label class="sf-label">URL</label>
                <input v-model="itemForm.link" class="sf-input" placeholder="https://…" />
            </template>
            <template v-else-if="folderName === 'code'">
                <label class="sf-label">Language</label>
                <input v-model="itemForm.language" class="sf-input" placeholder="cpp / python…" />
                <label class="sf-label">Code</label>
                <textarea v-model="itemForm.snippet" class="sf-textarea sf-code" rows="5" placeholder="Paste code…" />
            </template>
            <label class="sf-label">Notes</label>
            <textarea v-model="itemForm.notes" class="sf-textarea" rows="2" placeholder="Optional…" />
            <div class="sf-form-actions">
                <BaseButton size="sm" variant="secondary" @click="showItemForm = false">Cancel</BaseButton>
                <BaseButton size="sm" @click="saveTextItem" :disabled="addingItem">Save</BaseButton>
            </div>
        </div>

        <template v-if="!openFolderId">
            <div v-if="!nestedFolders.length && !looseItems.length" class="sf-empty">
                <vue-feather :type="schema.icon" class="sf-empty-icon" />
                <p class="sf-empty-title">Nothing here yet</p>
                <p class="sf-empty-sub">Create a folder, or add files and items directly.</p>
            </div>

            <div v-else class="sf-file-grid" @click="closeCtxMenu">
                <div v-for="nf in nestedFolders" :key="nf.id" class="sf-folder-card" @click="enterFolder(nf.id)"
                    role="button" tabindex="0" @keydown.enter="enterFolder(nf.id)">
                    <div class="sf-folder-thumb">
                        <div class="sf-folder-tab"
                            :style="{ background: schema.color + '33', borderColor: schema.color + '55' }" />
                        <div class="sf-folder-body" :style="{ borderColor: schema.color + '44' }">
                            <div class="sf-folder-previews">
                                <template v-for="item in (nf.items || []).slice(0, 4)" :key="item.id">
                                    <div v-if="isGithub(item)" class="sf-folder-preview-file"
                                        style="background:#0d111722;color:#58a6ff">
                                        <vue-feather type="github" size="16" />
                                    </div>
                                    <div v-else class="sf-folder-preview-file"
                                        :style="{ background: fileColor(item) + '22', color: fileColor(item) }">
                                        <span v-if="fileExt(item)" class="sf-folder-preview-ext">{{ fileExt(item)
                                        }}</span>
                                        <vue-feather v-else :type="schema.icon" size="14" />
                                    </div>
                                </template>
                                <div v-if="!(nf.items || []).length" class="sf-folder-preview-empty">
                                    <vue-feather :type="schema.icon" size="26" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sf-folder-info">
                        <span class="sf-folder-name">{{ nf.name }}</span>
                        <span class="sf-folder-meta">{{ (nf.items || []).length }} item{{ (nf.items || []).length !== 1
                            ? 's' : '' }}</span>
                    </div>
                    <button class="sf-folder-del" @click="deleteNestedFolder(nf, $event)" title="Delete">
                        <vue-feather type="x" size="15" />
                    </button>
                </div>

                <div v-for="item in looseItems" :key="item.id" class="sf-file-card"
                    @contextmenu="onContextMenu($event, item)">
                    <div class="sf-file-preview" @click="openLightbox(item)"
                        :style="{ cursor: (isDrive(item) || (fileUrls[item.id] && isImage(item))) ? 'zoom-in' : 'default' }">
                        <div v-if="isDrive(item)" class="sf-drive-preview" @click.stop="openDrivePreview(item)"
                            style="cursor: zoom-in;">
                            <img v-if="item.driveIcon" :src="item.driveIcon" class="sf-drive-favicon" alt="" />
                            <vue-feather v-else type="hard-drive" class="sf-drive-icon" />
                            <span class="sf-drive-name">{{ item.title }}</span>
                            <span class="sf-drive-cta">Click to preview</span>
                            <a :href="item.driveUrl" target="_blank" rel="noopener" class="sf-drive-open"
                                @click.stop>Open in Drive
                                ↗</a>
                        </div>
                        <a v-else-if="isGithub(item)" :href="item.githubUrl" target="_blank" rel="noopener"
                            class="sf-github-preview" @click.stop>
                            <vue-feather type="github" class="sf-github-icon" />
                            <span class="sf-github-repo">{{ item.githubOwner }}/{{ item.githubRepo }}</span>
                            <span class="sf-github-cta">Open on GitHub ↗</span>
                        </a>
                        <img v-else-if="fileUrls[item.id] && isImage(item)" :src="fileUrls[item.id]" class="sf-file-img"
                            :alt="item.title" />
                        <video v-else-if="fileUrls[item.id] && isVideo(item)" :src="fileUrls[item.id]"
                            class="sf-file-video" preload="metadata" />
                        <div v-else-if="item.fileName" class="sf-file-icon-block"
                            :style="{ background: fileColor(item) + '18' }">
                            <span class="sf-file-icon-badge" :style="{ background: fileColor(item) }">{{ fileExt(item)
                            }}</span>
                            <span class="sf-file-icon-name">{{ item.fileName }}</span>
                        </div>
                        <div v-else-if="uploading[item.id]" class="sf-file-icon-block">
                            <vue-feather type="loader" class="sf-spinner" />
                            <span class="sf-file-icon-name">Uploading…</span>
                        </div>
                        <label v-else-if="!item.snippet && !item.link" class="sf-file-upload-prompt">
                            <input type="file" :accept="schema.accept" class="sf-hidden-input"
                                @change="e => { const f = e.target.files?.[0]; if (f) _saveFile(item.id, f).then(); e.target.value = '' }" />
                            <vue-feather :type="schema.icon" class="sf-file-upload-icon" />
                            <span class="sf-file-upload-text">Attach file</span>
                        </label>
                        <div v-if="item.snippet" class="sf-code-preview">
                            <span class="sf-lang-tag">{{ item.language }}</span>
                            <pre class="sf-code-snippet">{{ item.snippet.slice(0, 120) }}</pre>
                        </div>
                        <div v-if="item.link" class="sf-link-preview">
                            <vue-feather type="link" class="sf-link-icon" />
                            <a :href="item.link" target="_blank" rel="noopener" class="sf-link-url">{{ item.link }}</a>
                        </div>
                    </div>
                    <div class="sf-file-footer">
                        <div class="sf-file-info">
                            <span class="sf-file-title">{{ item.title || item.fileName || 'Untitled' }}</span>
                            <span class="sf-file-size">{{ formatSize(item.fileSize) }}</span>
                        </div>
                        <div class="sf-file-actions">
                            <button v-if="item.fileName" class="sf-icon-btn" @click="removeFile(item)"
                                title="Remove file">
                                <vue-feather type="trash-2" size="13" />
                            </button>
                            <button class="sf-icon-btn sf-icon-btn--danger" @click="removeItem(item)" title="Delete">
                                <vue-feather type="x" size="13" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <template v-else-if="openFolder">
            <div v-if="!openFolderItems.length && !showItemForm && !showGithubForm" class="sf-empty">
                <vue-feather :type="schema.icon" class="sf-empty-icon" />
                <p class="sf-empty-title">This folder is empty</p>
                <p class="sf-empty-sub" v-if="isFileType">Upload files or drag them in.</p>
            </div>

            <div v-else-if="openFolderItems.length" class="sf-file-grid" @click="closeCtxMenu">
                <div v-for="item in openFolderItems" :key="item.id" class="sf-file-card"
                    @contextmenu="onContextMenu($event, item)">
                    <div class="sf-file-preview" @click="openLightbox(item)"
                        :style="{ cursor: (isDrive(item) || (fileUrls[item.id] && isImage(item))) ? 'zoom-in' : 'default' }">
                        <div v-if="isDrive(item)" class="sf-drive-preview" @click.stop="openDrivePreview(item)"
                            style="cursor: zoom-in;">
                            <img v-if="item.driveIcon" :src="item.driveIcon" class="sf-drive-favicon" alt="" />
                            <vue-feather v-else type="hard-drive" class="sf-drive-icon" />
                            <span class="sf-drive-name">{{ item.title }}</span>
                            <span class="sf-drive-cta">Click to preview</span>
                            <a :href="item.driveUrl" target="_blank" rel="noopener" class="sf-drive-open"
                                @click.stop>Open in Drive ↗</a>
                        </div>
                        <a v-else-if="isGithub(item)" :href="item.githubUrl" target="_blank" rel="noopener"
                            class="sf-github-preview" @click.stop>
                            <vue-feather type="github" class="sf-github-icon" />
                            <span class="sf-github-repo">{{ item.githubOwner }}/{{ item.githubRepo }}</span>
                            <span class="sf-github-cta">Open on GitHub ↗</span>
                        </a>
                        <img v-else-if="fileUrls[item.id] && isImage(item)" :src="fileUrls[item.id]" class="sf-file-img"
                            :alt="item.title" />
                        <video v-else-if="fileUrls[item.id] && isVideo(item)" :src="fileUrls[item.id]"
                            class="sf-file-video" preload="metadata" />
                        <div v-else-if="item.fileName" class="sf-file-icon-block"
                            :style="{ background: fileColor(item) + '18' }">
                            <span class="sf-file-icon-badge" :style="{ background: fileColor(item) }">{{ fileExt(item)
                            }}</span>
                            <span class="sf-file-icon-name">{{ item.fileName }}</span>
                        </div>
                        <div v-else-if="uploading[item.id]" class="sf-file-icon-block">
                            <vue-feather type="loader" class="sf-spinner" />
                            <span class="sf-file-icon-name">Uploading…</span>
                        </div>
                        <label v-else-if="!item.snippet && !item.link" class="sf-file-upload-prompt">
                            <input type="file" :accept="schema.accept" class="sf-hidden-input"
                                @change="e => { const f = e.target.files?.[0]; if (f) _saveFile(item.id, f).then(); e.target.value = '' }" />
                            <vue-feather :type="schema.icon" class="sf-file-upload-icon" />
                            <span class="sf-file-upload-text">Attach file</span>
                        </label>
                        <div v-if="item.snippet" class="sf-code-preview">
                            <span class="sf-lang-tag">{{ item.language }}</span>
                            <pre class="sf-code-snippet">{{ item.snippet.slice(0, 120) }}</pre>
                        </div>
                        <div v-if="item.link" class="sf-link-preview">
                            <vue-feather type="link" class="sf-link-icon" />
                            <a :href="item.link" target="_blank" rel="noopener" class="sf-link-url">{{ item.link }}</a>
                        </div>
                    </div>
                    <div class="sf-file-footer">
                        <div class="sf-file-info">
                            <span class="sf-file-title">{{ item.title || item.fileName || 'Untitled' }}</span>
                            <span class="sf-file-size">{{ formatSize(item.fileSize) }}</span>
                        </div>
                        <div class="sf-file-actions">
                            <button v-if="item.fileName" class="sf-icon-btn" @click="removeFile(item)"
                                title="Remove file">
                                <vue-feather type="trash-2" size="13" />
                            </button>
                            <button class="sf-icon-btn sf-icon-btn--danger" @click="removeItem(item)" title="Delete">
                                <vue-feather type="x" size="13" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>

    <Teleport to="body">
        <div v-if="showCreateModal" class="sf-backdrop" @click.self="showCreateModal = false">
            <div class="sf-modal">
                <div class="sf-modal-header">
                    <div class="sf-modal-icon" :style="{ background: schema.color + '22', color: schema.color }">
                        <vue-feather :type="schema.icon" size="22" />
                    </div>
                    <div>
                        <h3 class="sf-modal-title">New {{ schema.label }} Folder</h3>
                        <p class="sf-modal-sub">Give it a name like "Rev 1", "Main Board", "Final"</p>
                    </div>
                    <button class="sf-modal-close" @click="showCreateModal = false">×</button>
                </div>
                <input v-model="newFolderName" class="sf-input" placeholder="Folder name…"
                    @keydown.enter="createNestedFolder" autofocus />
                <div class="sf-modal-footer">
                    <BaseButton variant="secondary" @click="showCreateModal = false">Cancel</BaseButton>
                    <BaseButton @click="createNestedFolder" :disabled="!newFolderName.trim() || creatingFolder">
                        {{ creatingFolder ? 'Creating…' : 'Create Folder' }}
                    </BaseButton>
                </div>
            </div>
        </div>

        <div v-if="lightboxItem" class="sf-lightbox" @click="closeLightbox">
            <button class="sf-lightbox-close" @click="closeLightbox"><vue-feather type="x" size="26" /></button>
            <img :src="fileUrls[lightboxItem.id]" class="sf-lightbox-img" @click.stop :alt="lightboxItem.title" />
            <p class="sf-lightbox-caption">{{ lightboxItem.title || lightboxItem.fileName }}</p>
        </div>

        <div v-if="drivePreviewItem" class="sf-lightbox" @click="closeDrivePreview">
            <button class="sf-lightbox-close" @click="closeDrivePreview"><vue-feather type="x" size="26" /></button>
            <iframe :src="driveEmbedUrl(drivePreviewItem)" class="sf-drive-frame" @click.stop allow="autoplay"
                title="Drive preview" />
            <p class="sf-lightbox-caption">
                {{ drivePreviewItem.title }} ·
                <a :href="drivePreviewItem.driveUrl" target="_blank" rel="noopener" class="sf-frame-open">Open in Drive
                    ↗</a>
            </p>
        </div>

        <Transition name="ctx-fade">
            <div v-if="ctxMenu.visible" class="sf-ctx-menu" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
                @click.stop>
                <div class="sf-ctx-header">
                    <span class="sf-ctx-filename">{{ ctxMenu.item?.title || ctxMenu.item?.fileName || 'Item' }}</span>
                </div>
                <button v-if="ctxMenu.item && ctxMenu.item.driveId" class="sf-ctx-item" @click="ctxPreviewDrive">
                    <vue-feather type="eye" class="sf-ctx-icon" /> Preview
                </button>
                <button v-if="ctxMenu.item && isImage(ctxMenu.item) && fileUrls[ctxMenu.item.id]" class="sf-ctx-item"
                    @click="ctxOpenLightbox">
                    <vue-feather type="maximize-2" class="sf-ctx-icon" /> View full size
                </button>
                <button v-if="ctxMenu.item?.fileName" class="sf-ctx-item sf-ctx-item--danger" @click="ctxDeleteFile">
                    <vue-feather type="trash-2" class="sf-ctx-icon" /> Delete file
                </button>
                <div class="sf-ctx-divider" />
                <button class="sf-ctx-item sf-ctx-item--danger" @click="ctxDeleteItem">
                    <vue-feather type="x" class="sf-ctx-icon" /> Delete item entirely
                </button>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.sf {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

.sf-crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--color-text-muted);
}

.crumb-btn {
    background: none;
    border: none;
    font: inherit;
    font-size: 13px;
    color: var(--color-text-primary);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s;
}

.crumb-btn.muted {
    color: var(--color-text-muted);
}

.crumb-btn:hover {
    color: var(--color-accent);
}

.crumb-sep {
    color: var(--color-text-muted);
}

.crumb-current {
    font-weight: 600;
    color: var(--color-text-primary);
}

.sf-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    flex-wrap: wrap;
}

.sf-hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin: 0;
}

.sf-toolbar-actions {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
}

.btn-icon {
    font-weight: 700;
    margin-right: 3px;
}

.sf-upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: #fff;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;
}

.sf-upload-btn:hover {
    opacity: 0.88;
}

.sf-hidden-input {
    display: none;
}

.sf-empty {
    text-align: center;
    padding: 48px 24px;
    color: var(--color-text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.sf-empty-icon {
    width: 2.8rem;
    height: 2.8rem;
    opacity: 0.6;
}

.sf-empty-icon svg {
    width: 100%;
    height: 100%;
}

.sf-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
}

.sf-empty-sub {
    font-size: 12px;
    max-width: 260px;
    margin: 0;
}

.sf-drive-preview {
    width: 100%;
    height: 100%;
    padding: 14px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-decoration: none;
    background: #f1f3f4;
    transition: background 0.15s;
}

.sf-drive-preview:hover {
    background: #e8eaed;
}

.sf-drive-favicon {
    width: 28px;
    height: 28px;
}

.sf-drive-icon {
    color: #1a73e8;
}

.sf-drive-icon svg {
    width: 28px;
    height: 28px;
}

.sf-drive-name {
    font-size: 12px;
    font-weight: 600;
    color: #202124;
    text-align: center;
    word-break: break-word;
}

.sf-drive-cta {
    font-size: 10px;
    color: #1a73e8;
}

.sf-drive-open {
    font-size: 9px;
    color: #1a73e8;
    text-decoration: none;
    margin-top: 2px;
}

.sf-drive-open:hover {
    text-decoration: underline;
}

.sf-folder-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    border-radius: 12px;
    padding: 12px 12px 10px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-card);
    transition: border-color 0.15s, background 0.15s, transform 0.15s;
    outline: none;
}

.sf-folder-card:hover,
.sf-folder-card:focus {
    border-color: var(--color-accent);
    background: rgba(127, 119, 221, 0.04);
    transform: translateY(-2px);
}

.sf-folder-thumb {
    display: flex;
    flex-direction: column;
}

.sf-folder-tab {
    width: 44%;
    height: 14px;
    border: 1px solid;
    border-bottom: none;
    border-radius: 6px 8px 0 0;
}

.sf-folder-body {
    border: 1px solid;
    border-radius: 0 6px 8px 8px;
    overflow: hidden;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-input);
}

.sf-folder-previews {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 3px;
    padding: 6px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
}

.sf-folder-preview-file {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
}

.sf-folder-preview-ext {
    font-size: 8px;
    font-weight: 800;
}

.sf-folder-preview-empty {
    grid-column: span 2;
    grid-row: span 2;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    opacity: 0.35;
}

.sf-folder-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sf-folder-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sf-folder-meta {
    font-size: 11px;
    color: var(--color-text-muted);
}

.sf-folder-del {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 16px;
    cursor: pointer;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.15s, color 0.12s;
}

.sf-folder-card:hover .sf-folder-del {
    opacity: 1;
}

.sf-folder-del:hover {
    color: var(--color-error);
}

.sf-file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px;
}

.sf-file-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-bg-card);
    transition: border-color 0.15s, box-shadow 0.15s;
}

.sf-file-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 4px 20px rgba(127, 119, 221, 0.12);
}

.sf-file-preview {
    height: 130px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-input);
    position: relative;
}

.sf-file-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.2s;
}

.sf-file-card:hover .sf-file-img {
    transform: scale(1.03);
}

.sf-file-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.sf-github-preview {
    width: 100%;
    height: 100%;
    padding: 14px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    background: #0d1117;
    transition: background 0.15s;
}

.sf-github-preview:hover {
    background: #161b22;
}

.sf-github-icon svg {
    width: 28px;
    height: 28px;
}

.sf-github-repo {
    font-size: 12px;
    font-weight: 600;
    color: #e6edf3;
    text-align: center;
    word-break: break-word;
}

.sf-github-cta {
    font-size: 10px;
    color: #58a6ff;
}

.sf-file-upload-icon svg {
    width: 24px;
    height: 24px;
}

.sf-link-icon svg {
    width: 22px;
    height: 22px;
}

.sf-spinner svg {
    width: 22px;
    height: 22px;
}

.crumb-btn svg,
.sf-ctx-icon svg,
.btn-icon svg {
    vertical-align: middle;
}

.sf-file-icon-block {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    box-sizing: border-box;
}

.sf-file-icon-badge {
    display: inline-block;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 6px;
    letter-spacing: 0.04em;
}

.sf-file-icon-name {
    font-size: 11px;
    color: var(--color-text-muted);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
}

.sf-spinner {
    font-size: 22px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.sf-file-upload-prompt {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: background 0.15s;
}

.sf-file-upload-prompt:hover {
    background: rgba(127, 119, 221, 0.06);
}

.sf-file-upload-icon {
    font-size: 24px;
    opacity: 0.5;
}

.sf-file-upload-text {
    font-size: 11px;
    color: var(--color-text-muted);
}

.sf-code-preview {
    width: 100%;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: #0f1117;
}

.sf-lang-tag {
    font-size: 9px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    align-self: flex-start;
}

.sf-code-snippet {
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    color: #7dd3fc;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow: hidden;
    margin: 0;
    flex: 1;
}

.sf-link-preview {
    width: 100%;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.sf-link-url {
    font-size: 10px;
    color: var(--color-accent);
    word-break: break-all;
    text-decoration: none;
    text-align: center;
}

.sf-link-url:hover {
    text-decoration: underline;
}

.sf-file-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-top: 1px solid var(--color-border);
    gap: 6px;
}

.sf-file-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.sf-file-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sf-file-size {
    font-size: 10px;
    color: var(--color-text-muted);
}

.sf-file-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
}

.sf-icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 4px;
    border-radius: 4px;
    color: var(--color-text-muted);
    line-height: 1;
    transition: color 0.12s, background 0.12s;
}

.sf-icon-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--color-text-primary);
}

.sf-icon-btn--danger:hover {
    color: var(--color-error);
}

.sf-item-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}

.sf-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
}

.sf-input,
.sf-textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 8px 12px;
    border-radius: var(--radius-md);
    font: inherit;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
}

.sf-input:focus,
.sf-textarea:focus {
    border-color: var(--color-accent);
}

.sf-textarea {
    resize: vertical;
    line-height: 1.5;
}

.sf-code {
    font-family: 'Fira Code', monospace;
    font-size: 12px;
}

.sf-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
}

.sf-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.sf-modal {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 24px;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}

.sf-modal-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
}

.sf-modal-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
}

.sf-modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
}

.sf-modal-sub {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
}

.sf-modal-close {
    background: none;
    border: none;
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
    flex-shrink: 0;
}

.sf-modal-close:hover {
    color: var(--color-text-primary);
}

.sf-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.sf-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 32px;
    cursor: zoom-out;
}

.sf-lightbox-close {
    position: absolute;
    top: 18px;
    right: 22px;
    background: none;
    border: none;
    color: #fff;
    font-size: 28px;
    cursor: pointer;
    line-height: 1;
    z-index: 1;
}

.sf-lightbox-img {
    max-width: 100%;
    max-height: 85vh;
    border-radius: 8px;
    object-fit: contain;
    box-shadow: 0 12px 60px rgba(0, 0, 0, 0.6);
}

.sf-lightbox-caption {
    margin-top: 14px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
}

.sf-drive-frame {
    width: min(90vw, 1000px);
    height: min(85vh, 700px);
    border: none;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 12px 60px rgba(0, 0, 0, 0.6);
}

.sf-frame-open {
    color: #8ab4f8;
    text-decoration: none;
}

.sf-frame-open:hover {
    text-decoration: underline;
}

@media (max-width: 480px) {
    .sf-file-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
}

.sf-ctx-menu {
    position: fixed;
    z-index: 10001;
    min-width: 190px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2);
    padding: 4px;
    overflow: hidden;
}

.sf-ctx-header {
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 4px;
}

.sf-ctx-filename {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    max-width: 170px;
}

.sf-ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}

.sf-ctx-item:hover {
    background: rgba(127, 119, 221, 0.1);
}

.sf-ctx-item--danger {
    color: var(--color-error, #ef4444);
}

.sf-ctx-item--danger:hover {
    background: rgba(239, 68, 68, 0.1);
}

.sf-ctx-icon {
    font-size: 14px;
    flex-shrink: 0;
}

.sf-ctx-divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
}

.ctx-fade-enter-active {
    transition: opacity 0.1s, transform 0.1s;
}

.ctx-fade-leave-active {
    transition: opacity 0.08s;
}

.ctx-fade-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
}

.ctx-fade-leave-to {
    opacity: 0;
}
</style>