export function formatNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}

export function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function timeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`
  return `${Math.floor(seconds / 31536000)}y ago`
}

export function estimateReadingTime(text, wordsPerMinute = 150) {
  const words = text.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return { words, minutes }
}

export function wordCount(text) {
  if (!text?.trim()) return 0
  return text.trim().split(/\s+/).length
}

export function engagementRate(likes, views) {
  if (!views) return 0
  return ((likes / views) * 100).toFixed(2)
}

export function parseScriptSections(text) {
  const sections = { hook: '', intro: '', body: '', cta: '', outro: '' }
  const markers = ['HOOK', 'INTRO', 'BODY', 'CTA', 'OUTRO']
  let current = null

  for (const line of text.split('\n')) {
    const marker = markers.find(m => line.toUpperCase().includes(`[${m}]`))
    if (marker) {
      current = marker.toLowerCase()
      continue
    }
    if (current && sections[current] !== undefined) {
      sections[current] += line + '\n'
    }
  }

  // Trim each section
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim()
  }

  return sections
}
