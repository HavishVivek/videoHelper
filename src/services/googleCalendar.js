/**
 * Google Calendar API integration for syncing video production schedules
 */

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_NAME = 'YouTube Production Schedule'

/**
 * Get or create a dedicated YouTube production calendar
 */
export async function getOrCreateCalendar(accessToken) {
  try {
    // List all calendars
    const listResponse = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({}))

      // Provide more helpful error messages
      if (listResponse.status === 401) {
        throw new Error('Access token expired. Please sign out and sign back in to reconnect Google Calendar.')
      } else if (listResponse.status === 403) {
        const message = errorData.error?.message || ''
        if (message.includes('disabled')) {
          throw new Error('Google Calendar API is not enabled. Please enable it in Google Cloud Console.')
        } else if (message.includes('sufficient permission')) {
          throw new Error('Calendar permission not granted. Please sign out and sign back in to grant calendar access.')
        } else {
          throw new Error('Calendar access denied. Please check your Google Cloud Console settings.')
        }
      }

      throw new Error(`Failed to list calendars: ${listResponse.statusText}`)
    }

    const { items } = await listResponse.json()

    // Check if our calendar already exists
    const existingCalendar = items?.find(cal => cal.summary === CALENDAR_NAME)
    if (existingCalendar) {
      return existingCalendar.id
    }

    // Create a new calendar
    const createResponse = await fetch(`${CALENDAR_API_BASE}/calendars`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: CALENDAR_NAME,
        description: 'Production schedule for YouTube video ideas (scripting, filming, posting)',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    })

    if (!createResponse.ok) {
      throw new Error(`Failed to create calendar: ${createResponse.statusText}`)
    }

    const newCalendar = await createResponse.json()
    return newCalendar.id
  } catch (error) {
    console.error('Error getting/creating calendar:', error)
    throw error
  }
}

/**
 * Helper to handle API errors consistently
 */
function handleApiError(response, defaultMessage) {
  if (response.status === 401) {
    throw new Error('Access token expired. Please sign out and sign back in.')
  } else if (response.status === 403) {
    throw new Error('Calendar permission denied. Please sign out and sign back in to grant access.')
  }
  throw new Error(`${defaultMessage}: ${response.statusText}`)
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(accessToken, calendarId, event) {
  try {
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    })

    if (!response.ok) {
      handleApiError(response, 'Failed to create event')
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating calendar event:', error)
    throw error
  }
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(accessToken, calendarId, eventId, event) {
  try {
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/${calendarId}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    })

    if (!response.ok) {
      handleApiError(response, 'Failed to update event')
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating calendar event:', error)
    throw error
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(accessToken, calendarId, eventId) {
  try {
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete event: ${response.statusText}`)
    }

    return true
  } catch (error) {
    console.error('Error deleting calendar event:', error)
    throw error
  }
}

/**
 * List calendar events within a date range
 */
export async function listCalendarEvents(accessToken, calendarId, timeMin, timeMax) {
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    })

    const response = await fetch(`${CALENDAR_API_BASE}/calendars/${calendarId}/events?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      handleApiError(response, 'Failed to list events')
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('Error listing calendar events:', error)
    throw error
  }
}

/**
 * Create event object for Google Calendar API
 */
export function buildEventObject(idea, type) {
  const typeConfig = {
    script: {
      emoji: '📝',
      label: 'Scripting',
      startField: 'scheduledScriptDate',
      endField: 'scheduledScriptEndDate',
      color: '9' // Blue
    },
    film: {
      emoji: '🎥',
      label: 'Filming',
      startField: 'scheduledFilmDate',
      endField: 'scheduledFilmEndDate',
      color: '10' // Green
    },
    post: {
      emoji: '📺',
      label: 'Post',
      startField: 'scheduledPostDate',
      endField: 'scheduledPostDate',
      color: '5' // Yellow
    }
  }

  const config = typeConfig[type]
  if (!config) return null

  const startDate = idea[config.startField]
  const endDate = idea[config.endField] || startDate

  if (!startDate) return null

  return {
    summary: `${config.emoji} ${config.label}: ${idea.topic}`,
    description: idea.description || `YouTube video: ${idea.topic}`,
    start: {
      date: startDate // All-day event
    },
    end: {
      date: addDays(endDate, 1) // End date is exclusive in Google Calendar
    },
    colorId: config.color,
    extendedProperties: {
      private: {
        ideaId: idea.id,
        type: type,
        source: 'youtube-helper-app'
      }
    }
  }
}

/**
 * Helper to add days to a date string (YYYY-MM-DD)
 */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Sync a single idea to Google Calendar
 */
export async function syncIdeaToCalendar(accessToken, calendarId, idea, existingEventIds = {}) {
  const eventIds = { ...existingEventIds }
  const types = ['script', 'film', 'post']

  for (const type of types) {
    const eventData = buildEventObject(idea, type)

    // If no date for this type, delete existing event if any
    if (!eventData) {
      if (eventIds[type]) {
        try {
          await deleteCalendarEvent(accessToken, calendarId, eventIds[type])
          delete eventIds[type]
        } catch (error) {
          console.error(`Failed to delete ${type} event:`, error)
        }
      }
      continue
    }

    // Update or create event
    try {
      if (eventIds[type]) {
        // Update existing event
        await updateCalendarEvent(accessToken, calendarId, eventIds[type], eventData)
      } else {
        // Create new event
        const created = await createCalendarEvent(accessToken, calendarId, eventData)
        eventIds[type] = created.id
      }
    } catch (error) {
      console.error(`Failed to sync ${type} event:`, error)
    }
  }

  return eventIds
}

/**
 * Sync all ideas to Google Calendar
 */
export async function syncAllIdeasToCalendar(accessToken, ideas, existingCalendarId = null) {
  try {
    // Get or create calendar
    const calendarId = existingCalendarId || await getOrCreateCalendar(accessToken)

    const updatedIdeas = []

    for (const idea of ideas) {
      const eventIds = await syncIdeaToCalendar(
        accessToken,
        calendarId,
        idea,
        idea.googleCalendarEventIds || {}
      )

      updatedIdeas.push({
        ...idea,
        googleCalendarEventIds: eventIds,
        googleCalendarId: calendarId
      })
    }

    return {
      calendarId,
      ideas: updatedIdeas
    }
  } catch (error) {
    console.error('Error syncing all ideas:', error)
    throw error
  }
}

/**
 * Pull events from Google Calendar and match with ideas
 */
export async function pullEventsFromCalendar(accessToken, calendarId, ideas) {
  try {
    // Get events for next 6 months
    const timeMin = new Date()
    const timeMax = new Date()
    timeMax.setMonth(timeMax.getMonth() + 6)

    const events = await listCalendarEvents(accessToken, calendarId, timeMin, timeMax)

    // Filter events that were created by our app
    const ourEvents = events.filter(event =>
      event.extendedProperties?.private?.source === 'youtube-helper-app'
    )

    const updates = []

    for (const event of ourEvents) {
      const ideaId = event.extendedProperties.private.ideaId
      const type = event.extendedProperties.private.type
      const idea = ideas.find(i => i.id === ideaId)

      if (!idea) continue

      // Check if event dates have changed
      const startDate = event.start.date
      const endDate = subtractDays(event.end.date, 1) // Google Calendar end is exclusive

      const typeFields = {
        script: { start: 'scheduledScriptDate', end: 'scheduledScriptEndDate' },
        film: { start: 'scheduledFilmDate', end: 'scheduledFilmEndDate' },
        post: { start: 'scheduledPostDate', end: 'scheduledPostDate' }
      }

      const fields = typeFields[type]
      if (!fields) continue

      const hasChanged = idea[fields.start] !== startDate ||
                        (fields.end !== fields.start && idea[fields.end] !== endDate)

      if (hasChanged) {
        updates.push({
          ideaId,
          updates: {
            [fields.start]: startDate,
            [fields.end]: endDate
          }
        })
      }
    }

    return updates
  } catch (error) {
    console.error('Error pulling events from calendar:', error)
    throw error
  }
}

/**
 * Helper to subtract days from a date string (YYYY-MM-DD)
 */
function subtractDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
