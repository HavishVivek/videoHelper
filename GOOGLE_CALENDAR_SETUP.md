# Google Calendar Integration Setup Guide

This guide will help you enable two-way sync between the app's content calendar and Google Calendar.

## Prerequisites

- Google Cloud Console project (same one used for Firebase)
- Google account signed in to the app

## Setup Steps

### 1. Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one used for Firebase)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Calendar API"
5. Click **Enable**

### 2. Update OAuth Consent Screen (if needed)

1. Go to **APIs & Services** > **OAuth consent screen**
2. Add the Google Calendar scope if not already present:
   - `https://www.googleapis.com/auth/calendar`
3. Save changes

### 3. Sign in to the App

1. If already signed in, sign out and sign back in
2. This will request the new Google Calendar permission
3. Accept the calendar permission when prompted

## How It Works

### Initial Sync

1. Navigate to the **Calendar** view in the app
2. Click **"📅 Sync to Google Calendar"**
3. The app will:
   - Create a new calendar called "YouTube Production Schedule" in your Google account
   - Create events for all scheduled dates (scripting, filming, post dates)
   - Store event IDs for future updates

### Two-Way Sync Features

#### Push Updates (App → Google Calendar)
- When you change dates in the app, click **"⬆️ Push Updates"** to sync changes to Google Calendar
- Or enable **Auto-sync** to automatically push changes

#### Pull Updates (Google Calendar → App)
- If you change event dates in Google Calendar, click **"⬇️ Pull Updates"** to sync changes back to the app
- Only events created by the app will be synced back

#### Auto-Sync
- Toggle **Auto-sync** to automatically push changes when you update dates in the app
- Recommended for seamless integration

## Event Details

Each scheduled item creates a Google Calendar event with:

- **Scripting Events** (📝 Blue)
  - Title: "📝 Scripting: [Video Topic]"
  - Dates: From scheduledScriptDate to scheduledScriptEndDate

- **Filming Events** (🎥 Green)
  - Title: "🎥 Filming: [Video Topic]"
  - Dates: From scheduledFilmDate to scheduledFilmEndDate

- **Post Date Events** (📺 Yellow)
  - Title: "📺 Post: [Video Topic]"
  - Date: scheduledPostDate (single day)

## Calendar Management

### Viewing Your Schedule
- Open [Google Calendar](https://calendar.google.com)
- Look for the "YouTube Production Schedule" calendar in your calendar list
- You can toggle its visibility or change its color

### Editing Events
- You can edit event dates directly in Google Calendar
- Use **"⬇️ Pull Updates"** in the app to sync changes back
- Event titles and descriptions should be edited in the app

### Deleting Events
- Deleting an idea in the app automatically deletes associated calendar events
- If you delete an event in Google Calendar, it won't be recreated unless you delete and re-schedule in the app

## Troubleshooting

### "Not authenticated with Google" error
- Sign out and sign back in to grant calendar permissions

### "Failed to list calendars" error
- Ensure Google Calendar API is enabled in your Cloud Console project
- Check that the calendar scope is included in your OAuth consent screen

### Events not syncing
- Check if Auto-sync is enabled
- Try manually clicking **"⬆️ Push Updates"**
- Look for error messages in the sync panel

### Duplicate events
- The app uses event IDs to prevent duplicates
- If duplicates appear, try deleting them in Google Calendar and re-syncing from the app

## Privacy & Data

- Only events created by this app are synced (identified by metadata)
- Your other Google Calendar events are not accessed or modified
- Event data includes: title, dates, description, and internal IDs
- All data is stored in your Google Calendar and Firebase/localStorage

## Advanced Usage

### Multiple Devices
- Calendar sync state is stored per user
- Syncing from one device updates Google Calendar for all devices
- Use **"⬇️ Pull Updates"** on other devices to stay current

### Calendar Sharing
- You can share the "YouTube Production Schedule" calendar with team members
- They'll see your production schedule in their Google Calendar
- Changes they make can be pulled back into the app

### API Quotas
- Google Calendar API has generous quota limits
- Normal usage (100s of events) won't hit limits
- If you encounter quota errors, wait a few minutes and try again

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all setup steps are completed
3. Try signing out and back in
4. Disable and re-enable Auto-sync
