# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Vue 3 application that helps YouTube creators generate AI-powered video scripts, analyze channel performance, and predict video success. Uses Groq (Llama 3.3) for script generation, YouTube Data API for channel analysis, and Firebase for authentication and data persistence.

## Development Commands

```bash
# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

The application requires a `.env` file with:
- `VITE_FIREBASE_*` - Firebase configuration (Auth, Firestore)
- `VITE_YOUTUBE_API_KEY` - YouTube Data API v3 key
- `VITE_GROQ_API_KEY` - Groq API key for LLM features
- `VITE_USE_EMULATORS` - Set to `true` for local Firebase emulators (optional)

The app is designed to work offline/degraded when Firebase is not configured - it falls back to localStorage.

## Architecture

### State Management (Pinia)

Four primary stores manage application state:

1. **auth** (`src/stores/auth.js`) - Firebase authentication with Google OAuth, includes YouTube and Google Calendar API scopes
2. **channel** (`src/stores/channel.js`) - YouTube channel data, videos, and AI-generated analysis
3. **scripts** (`src/stores/scripts.js`) - Script generation, variations, predictions, thumbnails, and metadata
4. **ideas** (`src/stores/ideas.js`) - Video ideas, subtasks, scheduling, and Google Calendar sync

**Storage Pattern**: All stores use a Firebase/localStorage hybrid approach. The `fsSet`, `fsGet`, `fsGetAll`, `fsDelete` functions in `scripts.js` attempt Firestore first, then gracefully fall back to localStorage if Firebase is unavailable. This pattern enables offline-first capability.

### Service Layer

- **firebase.js** - Initializes Firebase app, Auth, and Firestore; exports `firebaseConfigured` flag. OAuth scopes include YouTube and Google Calendar.
- **youtube.js** - YouTube Data API client for fetching channels, videos, and metadata
- **groq.js** - Groq SDK integration with system prompts for:
  - Channel analysis
  - Script generation (with streaming support)
  - Intro variations
  - Script variations (Educational, Entertaining, Storytelling styles)
  - Performance prediction
  - Thumbnail concepts
  - Metadata optimization
- **googleCalendar.js** - Google Calendar API integration for two-way sync of production schedules:
  - Creates/updates/deletes calendar events
  - Syncs scripting, filming, and post dates
  - Manages a dedicated "YouTube Production Schedule" calendar
  - Supports pulling updates from Google Calendar back to the app

### Composables

Composables wrap store logic and provide reusable patterns:
- **useAuth.js** - Authentication state and methods
- **useChannel.js** - Channel loading, video fetching, and analysis
- **useScripts.js** - Script operations including `setupAutoSave` for debounced saving
- **useGroq.js** - Direct access to Groq service methods
- **useCalendarSync.js** - Google Calendar sync operations and state

### Routing

All routes except `/` (Dashboard) require authentication via `meta: { requiresAuth: true }`. The router guard checks `authStore.isAuthenticated` and redirects unauthenticated users to the dashboard.

### Component Organization

- **layout/** - Navbar, Sidebar, PageContainer (app shell)
- **ui/** - Reusable base components (BaseButton, GlassCard, BaseModal, BaseInput, etc.)
- **channel/** - ChannelCard, VideoCard, AnalyticsChart
- **script/** - IntroOption, ScriptEditor, ScriptVariation, PackagingView
- **dashboard/** - PredictionCard, ComparisonChart
- **views/** - Page-level components (DashboardView, ChannelView, ScriptGeneratorView, EditorView, PredictionsView, ImportScriptView)

### Authentication Flow

On app initialization (`main.js`), the auth store's `initAuth()` method is called before mounting. This waits for Firebase's `onAuthStateChanged` listener to resolve, ensuring the user state is known before rendering. Unauthenticated users can still view the Dashboard but cannot access protected features.

Google OAuth requests the following scopes:
- `youtube.readonly` - Read YouTube channel data
- `yt-analytics.readonly` - Read YouTube analytics data
- `calendar` - Read/write Google Calendar events for production schedule sync

### AI Script Generation Workflow

1. User searches for a YouTube channel (via handle like `@username`)
2. App fetches channel data and top videos via YouTube Data API
3. Groq analyzes channel patterns and generates insights
4. User provides a video topic and optional notes
5. Groq generates 4 intro variations with different hook types (Question, Story, Bold Statement, Problem/Solution)
6. User selects an intro variation
7. Groq generates 3 full script variations in different styles (Educational, Entertaining, Storytelling)
8. User selects a variation to save or continue editing
9. Optional: Generate performance predictions, thumbnail concepts, and metadata

**Streaming**: Script generation uses streaming responses from Groq to provide real-time feedback during generation.

### Data Persistence

Scripts are stored with this structure:
```js
{
  id: 'script_${timestamp}',
  userId: 'firebase_uid_or_anonymous',
  channelId: 'youtube_channel_id',
  topic: 'Video topic',
  selectedIntro: 'Chosen intro text',
  content: 'Full script with [HOOK], [INTRO], [BODY], [CTA], [OUTRO] markers',
  isManual: boolean, // true if imported/written manually
  prediction: { /* AI performance prediction */ },
  thumbnails: [ /* AI thumbnail concepts */ ],
  metadata: { titles, description, tags, category },
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

Auto-save is implemented in `useScripts.setupAutoSave()` with a 2-second debounce.

## Key Technical Patterns

- **Vue 3 `<script setup>` SFCs** - All components use Composition API with `<script setup>`
- **Path aliases** - `@/` resolves to `src/` (configured in `vite.config.js`)
- **Async imports** - Firebase methods are dynamically imported to reduce initial bundle size
- **Error boundaries** - Services handle errors gracefully and set error state in stores
- **Lazy route loading** - All views are code-split with `() => import()`

## YouTube API Notes

- **Rate Limits**: YouTube Data API has quota limits; batch video requests in groups of 50 (API max)
- **Duration Parsing**: Video durations are in ISO 8601 format (e.g., `PT5M30S`); use `parseDuration()` in `youtube.js`
- **Channel Lookup**: Always use `forHandle` parameter for handle-based searches, strip leading `@` first

## Groq/LLM Integration

- **Model**: `llama-3.3-70b-versatile` for all operations
- **JSON Mode**: Many endpoints use `response_format: { type: 'json_object' }` for structured responses
- **Streaming**: Full script generation supports streaming via `streamFullScript()` generator function
- **System Prompts**: Defined in `SYSTEM_PROMPTS` object in `groq.js` - modify these to change AI behavior
- **Error Handling**: Always parse JSON responses with try/catch; fallback to sensible defaults

## Google Calendar Integration

The app supports two-way sync between the content calendar and Google Calendar.

### Setup Requirements
- Google Calendar API enabled in Cloud Console (see `GOOGLE_CALENDAR_SETUP.md`)
- OAuth scope `https://www.googleapis.com/auth/calendar` (already added to `firebase.js`)
- User signed in with Google

### Sync Features

**Push to Google Calendar** - Creates/updates events in a dedicated "YouTube Production Schedule" calendar:
- 📝 Scripting events (Blue) - from `scheduledScriptDate` to `scheduledScriptEndDate`
- 🎥 Filming events (Green) - from `scheduledFilmDate` to `scheduledFilmEndDate`
- 📺 Post events (Yellow) - on `scheduledPostDate`

**Pull from Google Calendar** - Detects changes made in Google Calendar and updates the app

**Auto-sync** - When enabled, automatically pushes date changes to Google Calendar

### Data Storage
- `googleCalendarId` - ID of the synced calendar (stored in localStorage per user)
- `googleCalendarEventIds` - Object mapping event types to Google Calendar event IDs (stored in each idea)
- `autoSyncEnabled` - Boolean flag for auto-sync preference (stored in localStorage per user)

### API Methods
All methods in `googleCalendar.js` use the Google Calendar REST API v3 with OAuth access tokens from Firebase Auth.

Events are tagged with `extendedProperties.private.source = 'youtube-helper-app'` to identify app-created events.

## Testing Strategy

Currently no test framework is configured. When adding tests, consider:
- Unit tests for utility functions (`formatters.js`, YouTube duration parsing)
- Integration tests for store actions
- E2E tests for critical flows (auth, script generation)

## Common Patterns

**Loading States**: Stores expose `loading` and `generating` refs; components should show skeleton states during these phases.

**Error Handling**: Stores set `error.value = e.message`; UI components should display error state and allow retry.

**Computed Properties**: Use `computed()` from stores in components rather than duplicating logic.
