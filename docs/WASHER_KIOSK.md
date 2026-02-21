# Washer Kiosk Mode

The Washer Kiosk provides a simplified, login-free interface for wash station operators to register vehicle cleaning tasks directly from a tablet or phone, without needing a username, PIN, or password.

## Instant UX Features

### Quick Plate (Next-Car Mode)

1. The plate input is **auto-focused** when the kiosk loads
2. Type any part of a plate number — a live match preview appears below
3. Press **Enter** to instantly create a wash task for the matched vehicle
4. The input is **automatically cleared and refocused** (next-car mode — no tap needed)
5. The new task appears in the list immediately (**optimistic UI**)

### Service Presets

Tap a preset to apply a service combination in one tap:

| Preset | Exterior | Interior | Vacuum | Notes |
|---|---|---|---|---|
| Basic | ✓ | — | — | — |
| Full | ✓ | ✓ | ✓ | — |
| Express | ✓ | — | ✓ | — |
| VIP | ✓ | ✓ | ✓ | "VIP — priority wash" |

Individual checkboxes can be toggled after selecting a preset.

### One-Hand Action Buttons

For each synced task, three large action buttons are shown:
- **▶ Start** — marks task as `IN_PROGRESS`
- **✓ Done** — marks task as `DONE`
- **⚠ Issue** — marks task as `BLOCKED`

These call `PATCH /api/kiosk/tasks/[id]` directly with the new status.

## Installing as a PWA on a Tablet

1. Open the kiosk URL in Chrome/Edge on the tablet: `https://your-domain.com/washers/app`
2. Tap the browser menu (⋮) → **"Install app"** or **"Add to Home screen"**
3. The kiosk launches in standalone mode (no browser chrome)
4. The device automatically generates a unique `KIOSK_DEVICE_ID` stored in the browser

## Required Environment Variables

Set these on the server (e.g., Vercel, `.env.local`). **Never commit actual secrets.**

| Variable | Required | Scope | Description |
|---|---|---|---|
| `KIOSK_TOKEN` | **Yes** | Server-only | Secret token authorizing kiosk write access. Without this, the kiosk loads in **read-only mode**. |
| `KIOSK_STATION_ID` | Recommended | Server-only | Identifies the station/workspace scope. Defaults to `"default"`. |
| `NEXT_PUBLIC_FEATURE_VOICE_INPUT` | Optional | Client | Set to `"1"` to enable voice-to-text in forms. |

### Example `.env.local`

```bash
KIOSK_TOKEN="my-secure-random-token-min-32-chars"
KIOSK_STATION_ID="station-main"
```

## Offline Support

When the device loses connectivity:
- The sync status badge changes to **"● Offline"**
- New task submissions are **queued locally** (localStorage) with a `status: "pending"` indicator
- Each queued task keeps its `idempotencyKey` so retries cannot create duplicates
- When connectivity returns, pending tasks are **automatically flushed** (15-second interval)

Sync status badge states:
| Badge | Meaning |
|---|---|
| `● Online` (green) | Connected, all tasks synced |
| `● Syncing (N)` (amber) | N tasks pending sync |
| `● Offline` (red) | No connectivity |

## How Dedupe / Idempotency Works

Every kiosk submission includes:

- **`idempotencyKey`** — a UUID generated per submission on the client
- **`deviceId`** — the persistent device identifier

The server enforces three levels of deduplication:

1. **Idempotency key** — If a task with the same `idempotencyKey` already exists, the server returns the existing record. No duplicate is created.
2. **Active task per vehicle** — If an active task (status `TODO` or `IN_PROGRESS`) already exists for the same vehicle on the same day, the server merges/updates the existing task instead of creating a new one.
3. **Offline queue** — When offline, submissions are queued locally with their `idempotencyKey`. When connectivity returns, they are retried with the same key, guaranteeing no duplicates.

The UI shows the result:
- **"Task created"** — a new task was created
- **"Existing task updated (deduped)"** — an existing task was found and updated

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/kiosk/tasks` | Create or merge a wash task |
| `GET` | `/api/kiosk/tasks?workspaceId=&date=` | List tasks for a given date |
| `PATCH` | `/api/kiosk/tasks/[id]` | Update task status (Start/Done/Issue) |

All endpoints:
- Require the `x-kiosk-token` header (constant-time comparison)
- Return `X-Request-Id` for log correlation
- Log structured timing JSON (`durationMs`)
- Are rate-limited: 30 requests per minute per `deviceId + stationId`

## Read-Only Mode

If the `KIOSK_TOKEN` environment variable is missing or invalid:

- The kiosk page still loads and displays the form
- All form fields and the submit button are **disabled**
- A prominent warning banner appears: *"Read-only mode: Kiosk token is missing or invalid."*
- No writes to the database are possible

### Troubleshooting Read-Only Mode

1. Verify `KIOSK_TOKEN` is set on the server (not in `NEXT_PUBLIC_*` variables)
2. Restart the application after changing env vars
3. Check server logs for `kiosk_unauthorized_write` security events
4. Ensure the token value matches between server config and the rendered page

## Revoking / Rotating the Kiosk Token

1. Generate a new strong random secret (e.g., `openssl rand -hex 32`)
2. Update `KIOSK_TOKEN` in your environment variables
3. Redeploy / restart the application
4. All existing kiosk sessions will immediately switch to read-only mode until they reload the page with the new token

Since the token is injected server-side at render time, rotating it takes effect on the next page load of each kiosk terminal.

## Audit Logging

All kiosk actions produce audit log entries with:

| Field | Description |
|---|---|
| `action` | `kiosk.task_created`, `kiosk.task_merged`, `kiosk.task_dedupe_hit` |
| `stationId` | The station identifier |
| `deviceId` | The kiosk device UUID |
| `idempotencyKey` | The submission UUID |
| `severity` | `normal` (or `high` for overrides) |

## Rate Limiting

Kiosk requests are rate-limited per `deviceId + stationId` combination:
- **30 requests per minute** per device
- Exceeding the limit returns HTTP 429 with a `retryAfterSeconds` value

## Architecture

```
Browser (Kiosk PWA)
  ├─ Generates KIOSK_DEVICE_ID (localStorage)
  ├─ Generates idempotencyKey per submission (UUID)
  ├─ Quick Plate: type plate → Enter → optimistic task → POST /api/kiosk/tasks
  ├─ Action buttons: Start/Done/Issue → PATCH /api/kiosk/tasks/[id]
  └─ Queues offline submissions in localStorage (flushes on reconnect)

Server
  ├─ Validates KIOSK_TOKEN (constant-time comparison)
  ├─ Rate limits by deviceId + stationId
  ├─ Deduplicates by idempotencyKey + active vehicle check
  ├─ Creates/updates WasherTask in database (minimal select — no overfetch)
  ├─ Returns X-Request-Id + structured timing log
  └─ Writes audit log entries

Main App (/washers)
  ├─ "Open Kiosk App" button → /washers/app
  ├─ Daily Register table with date picker
  └─ CSV export for any date
```

