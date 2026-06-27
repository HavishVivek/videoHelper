// src/api/client.js
// Thin wrapper around fetch that attaches the current user's Firebase ID token
// to every request to the Node backend. All backend feature calls (AI search,
// Notion, Calendar, Drive) should go through apiPost / apiGet so auth and error
// handling stay consistent in one place.

import { getAuth } from 'firebase/auth'

// Base URL switches automatically between the local backend and production.
// import.meta.env.DEV is true on localhost:5173 and false in production builds.
const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8080'
  : (import.meta.env.VITE_API_BASE_URL || 'https://your-backend-url.com')

/**
 * Get a fresh Firebase ID token for the signed-in user.
 * Uses getAuth().currentUser (the live User instance) — NOT a serialized
 * copy from a store, which can't mint tokens.
 */
async function getToken() {
  const user = getAuth().currentUser
  if (!user) {
    throw new Error('Not signed in')
  }
  // getIdToken() auto-refreshes if the token is near expiry.
  return user.getIdToken()
}

/**
 * Core request function. Attaches the token, sends/parses JSON, and throws an
 * Error with the backend's message on non-2xx responses.
 */
async function request(path, { method = 'GET', body } = {}) {
  const token = await getToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Try to parse a JSON body either way so we can surface backend error text.
  let data = null
  try {
    data = await res.json()
  } catch {
    // Some responses (e.g. 204) have no body — that's fine.
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`
    throw new Error(message)
  }

  return data
}

/** POST JSON to the backend. Returns the parsed JSON response. */
export function apiPost(path, body) {
  return request(path, { method: 'POST', body })
}

/** GET JSON from the backend. Returns the parsed JSON response. */
export function apiGet(path) {
  return request(path, { method: 'GET' })
}