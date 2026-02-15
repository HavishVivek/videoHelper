import axios from 'axios'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

function createClient() {
  return axios.create({
    baseURL: API_BASE,
    params: {
      key: import.meta.env.VITE_YOUTUBE_API_KEY
    }
  })
}

export async function fetchChannelByHandle(handle) {
  const client = createClient()
  // Strip leading @ if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

  const { data } = await client.get('/channels', {
    params: {
      part: 'snippet,statistics,contentDetails',
      forHandle: cleanHandle
    }
  })
  if (!data.items?.length) throw new Error(`No channel found for @${cleanHandle}`)
  const ch = data.items[0]
  return {
    id: ch.id,
    handle: `@${cleanHandle}`,
    title: ch.snippet.title,
    description: ch.snippet.description,
    thumbnail: ch.snippet.thumbnails.medium?.url || ch.snippet.thumbnails.default?.url,
    subscriberCount: parseInt(ch.statistics.subscriberCount) || 0,
    videoCount: parseInt(ch.statistics.videoCount) || 0,
    viewCount: parseInt(ch.statistics.viewCount) || 0,
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads
  }
}

export async function fetchVideos(uploadsPlaylistId, maxResults = 200) {
  const client = createClient()
  const allVideoIds = []
  let nextPageToken = null

  // Paginate through the uploads playlist
  do {
    const { data: playlistData } = await client.get('/playlistItems', {
      params: {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        ...(nextPageToken && { pageToken: nextPageToken })
      }
    })

    allVideoIds.push(...playlistData.items.map(item => item.contentDetails.videoId))
    nextPageToken = playlistData.nextPageToken
  } while (nextPageToken && allVideoIds.length < maxResults)

  if (!allVideoIds.length) return []

  // Fetch video details in batches of 50 (API limit per request)
  const allVideos = []
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50)
    const { data: videosData } = await client.get('/videos', {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: batch.join(',')
      }
    })

    allVideos.push(...videosData.items.map(v => ({
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails.medium?.url || v.snippet.thumbnails.default?.url,
      publishedAt: v.snippet.publishedAt,
      duration: v.contentDetails.duration,
      viewCount: parseInt(v.statistics.viewCount) || 0,
      likeCount: parseInt(v.statistics.likeCount) || 0,
      commentCount: parseInt(v.statistics.commentCount) || 0,
      tags: v.snippet.tags || []
    })))
  }

  return allVideos
}

export async function fetchVideoDetails(videoId) {
  const client = createClient()
  const { data } = await client.get('/videos', {
    params: {
      part: 'snippet,statistics,contentDetails',
      id: videoId
    }
  })
  if (!data.items?.length) throw new Error('Video not found')
  const v = data.items[0]
  return {
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    thumbnail: v.snippet.thumbnails.high?.url,
    publishedAt: v.snippet.publishedAt,
    duration: v.contentDetails.duration,
    viewCount: parseInt(v.statistics.viewCount) || 0,
    likeCount: parseInt(v.statistics.likeCount) || 0,
    commentCount: parseInt(v.statistics.commentCount) || 0,
    tags: v.snippet.tags || []
  }
}

export function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1]) || 0
  const minutes = parseInt(match[2]) || 0
  const seconds = parseInt(match[3]) || 0
  return hours * 3600 + minutes * 60 + seconds
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
