// Loads Google's gapi + GIS scripts and opens the Drive Picker.
// Requires CLIENT_ID, API_KEY, APP_ID from Google Cloud Console.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const API_KEY   = import.meta.env.VITE_GOOGLE_API_KEY
const APP_ID    = import.meta.env.VITE_GOOGLE_APP_ID

const SCOPES = 'https://www.googleapis.com/auth/drive.file'

let pickerApiLoaded = false
let tokenClient = null
let accessToken = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureLoaded() {
  await loadScript('https://apis.google.com/js/api.js')
  await loadScript('https://accounts.google.com/gsi/client')

  if (!pickerApiLoaded) {
    await new Promise((resolve) => window.gapi.load('picker', resolve))
    pickerApiLoaded = true
  }

  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {}, // set per-request below
    })
  }
}

function getToken() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp)
      accessToken = resp.access_token
      resolve(accessToken)
    }
    // prompt only if we don't already have a token
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  })
}

/**
 * Opens the Drive Picker and resolves with an array of chosen files:
 * [{ id, name, url, mimeType, iconUrl }]
 */
export async function openDrivePicker() {
    console.log('KEY AT CALL TIME:', API_KEY)
    console.log('APP ID:', APP_ID, 'CLIENT ID:', CLIENT_ID)
    await ensureLoaded()
    await getToken()

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)

    const picker = new window.google.picker.PickerBuilder()
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setAppId(APP_ID)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .addView(view)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const files = (data.docs || []).map(d => ({
            id: d.id,
            name: d.name,
            url: d.url,
            mimeType: d.mimeType,
            iconUrl: d.iconUrl,
          }))
          resolve(files)
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([])
        }
      })
      .build()

    picker.setVisible(true)
  })
}