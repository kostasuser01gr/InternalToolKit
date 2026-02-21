# Washers Kiosk — Quick Plate, Presets, Offline Queue & Dedupe

## Overview

The Washer Kiosk (`/kiosk/washers/app`) is a tablet-optimized interface for wash station operators. It enables ultra-fast task registration with minimal taps.

## Features

### Quick Plate Input (Next-car Mode)
- Autofocused text input at top of page
- Type a plate number → live match preview shows matching vehicle
- Press **Enter** to instantly create the task
- Cursor returns to plate input after save (Next-car mode)
- Supports both exact and partial plate matching

### Service Presets
Four configurable presets map to service checkboxes:

| Preset  | Exterior | Interior | Vacuum | Notes             |
|---------|----------|----------|--------|-------------------|
| Basic   | ✓        |          |        |                   |
| Full    | ✓        | ✓        | ✓      |                   |
| Express | ✓        |          | ✓      |                   |
| VIP     | ✓        | ✓        | ✓      | VIP — priority wash |

- Active preset is highlighted with purple glow
- Manual checkbox changes clear the active preset indicator
- Feature flag: `NEXT_PUBLIC_FEATURE_KIOSK_PRESETS`

### One-hand Action Buttons
Each synced task in the queue shows three large action buttons:
- **▶ Start** → sets task status to `IN_PROGRESS`
- **✓ Done** → sets task status to `DONE`
- **⚠ Issue** → sets task status to `BLOCKED`

Buttons are disabled when that status is already active.

### Offline Queue
- Tasks created while offline are stored in localStorage
- Pending count shown in header sync indicator
- Auto-retry every 15 seconds when back online
- Each task has a unique `idempotencyKey` (UUID) to prevent duplicates
- Feature flag: `NEXT_PUBLIC_FEATURE_OFFLINE_QUEUE`

### Smart Dedupe / Merge
- Idempotency: same `idempotencyKey` → same record (no duplicate)
- Active task merge: if same vehicle has an active task (TODO/IN_PROGRESS) today, the existing task is updated instead of creating a new one
- Status labels: "Created" for new tasks, "Updated (deduped)" for merged tasks

### Sync Status Indicator
Header shows real-time status:
- 🟢 **Online** — all synced
- 🟡 **Syncing (N)** — N pending tasks
- 🔴 **Offline** — queued for later

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KIOSK_TOKEN` | Shared secret for kiosk write access | (required) |
| `KIOSK_STATION_ID` | Station identifier | `default` |

## Verification Checklist

1. Open `/kiosk/washers/app` on tablet
2. Verify Quick Plate input is autofocused
3. Type a plate number → see live match preview
4. Press Enter → task appears in queue with "Created" badge
5. Press Enter again with same plate → see "Updated (deduped)" badge
6. Select preset → verify checkboxes update correctly
7. Tap Start/Done/Issue buttons → verify status updates
8. Turn off network → create task → verify "Pending" badge → turn on network → verify auto-sync
