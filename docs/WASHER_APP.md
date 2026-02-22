# Washer Companion App (PWA)

## Overview
Installable Progressive Web App at `/washers/app` — designed for washer staff on any device. No login required.

## Installation

### iOS
1. Open the share link in Safari
2. Tap Share → Add to Home Screen
3. Launch from home screen (runs in standalone mode)

### Android
1. Open the share link in Chrome
2. Tap Menu → Install App (or "Add to Home Screen")
3. Launch from app drawer

### Desktop
1. Open in Chrome
2. Click the install icon in the address bar
3. App opens in its own window

## Share Link Format
```
/washers/app?kiosk=<TOKEN>&station=<STATION_ID>&theme=<THEME>
```
- `kiosk`: Required for write access. Without it, app runs in read-only mode.
- `station`: Station identifier (defaults to env KIOSK_STATION_ID)
- `theme`: Optional theme override (quantum, dark, light, high-contrast)

## Tabs

### Tasks (default)
- **Quick Plate Input**: Type plate → Enter → instant task creation (next-car autofocus)
- **Service Presets**: Basic, Full, Express, VIP
- **Service Checkboxes**: Exterior, Interior, Vacuum
- **Register Form**: Full vehicle selection + notes
- **Recent Submissions**: Live status (Pending/Synced/Failed)
- **One-Hand Actions**: Start, Done, Issue buttons per task

### History
- All tasks recorded on this device
- Stats: Total, Synced, Pending, Failed
- Per-task details with timestamps

### Chat
- Posts to `#washers-only` internal channel
- Load messages on demand
- Send messages (requires valid kiosk token)
- Messages appear in main app's chat view

### Settings
- **Theme Switch**: Quantum, Dark, Light, High Contrast
- **Device Info**: Device ID, Station, Workspace, Token status, Voice, Connection
- **Clear Local History**: Reset local task queue

## Theme Switching
- Persisted in localStorage per device (no login needed)
- Link param `&theme=quantum` applies on first load
- Available themes: Quantum (default), Dark, Light, High Contrast

## Voice Input
- Behind feature flag: `NEXT_PUBLIC_FEATURE_VOICE_INPUT=1`
- Uses Web Speech API
- Tap mic → speak → review transcript → confirm to add to notes
- Manual confirmation required before saving

## Offline Queue
- Tasks queued in localStorage when offline
- Auto-sync when connection restored
- States: Pending → Synced | Failed
- Retry on reconnect

## Security
- **Kiosk Token**: Server-side validation via constant-time comparison
- **Read-Only Mode**: Missing/invalid token → clear banner, writes disabled
- **Rate Limiting**: Per deviceId + stationId
- **Idempotency**: UUID per submission, server-side dedupe

## Deduplication
- Each task has unique `idempotencyKey` (UUID)
- Server checks for existing task with same key
- One active cleaning task per vehicle enforced
- Merge policy for same plate within day window
