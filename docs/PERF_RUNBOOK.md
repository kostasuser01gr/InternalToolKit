# Performance Runbook — Washer Kiosk

## What We Measure

### Server-Side Timing

All kiosk API endpoints emit a structured JSON log on every request:

```json
{
  "event": "kiosk.task_created",
  "requestId": "...",
  "route": "/api/kiosk/tasks",
  "method": "POST",
  "status": 201,
  "durationMs": 38,
  "vehicleId": "...",
  "deviceId": "...",
  "stationId": "..."
}
```

Events logged:
| Event | Route | Trigger |
|---|---|---|
| `kiosk.task_created` | `POST /api/kiosk/tasks` | New task created |
| `kiosk.task_merged` | `POST /api/kiosk/tasks` | Active task merged (dedupe) |
| `kiosk.task_dedupe_hit` | `POST /api/kiosk/tasks` | Idempotency key hit |
| `kiosk.tasks_listed` | `GET /api/kiosk/tasks` | Daily task list fetched |
| `kiosk.task_updated` | `PATCH /api/kiosk/tasks/[id]` | Task status changed |

### Client-Side Timing Marks

The kiosk client uses browser `performance.mark` idiomatically through React's render timing. For manual measurement, open DevTools → Performance → record while submitting a task.

Key interactions to profile:
1. `DOMContentLoaded` → plate input focused (target: <200 ms)
2. Enter keypress → optimistic task appears in list (target: <16 ms — synchronous state update)
3. Enter keypress → network response → status badge updates (target: <300 ms on good Wi-Fi)

### Response Headers

Every kiosk API response includes `X-Request-Id`. Use this to correlate client network logs with server logs.

---

## Performance Targets

| Metric | Target | Notes |
|---|---|---|
| Time to plate input focused | < 200 ms | From navigation start |
| Optimistic task appear (Enter → UI) | < 16 ms | Synchronous React state update |
| POST /api/kiosk/tasks (server only) | < 100 ms | Normal DB; excludes network |
| PATCH /api/kiosk/tasks/[id] (server) | < 60 ms | Simple update |
| Daily register page load | < 500 ms | Indexed queries |

---

## How to Catch Regressions

### 1. Unit Tests

Run after every change:
```bash
pnpm --filter @internal-toolkit/web test:unit
```

Tests cover:
- Preset application logic (all 4 presets)
- Quick plate vehicle lookup (exact + partial match)
- Offline queue enqueue/dedupe/flush transitions
- Kiosk token validation
- Rate limiting
- Idempotency schema validation
- Task update schema

### 2. Typecheck

```bash
pnpm --filter @internal-toolkit/web typecheck
```

### 3. Lint

```bash
pnpm --filter @internal-toolkit/web lint
```

### 4. Build

```bash
pnpm --filter @internal-toolkit/web build
```

Check that the kiosk route (`/washers/app`) compiles without errors and the JS bundle does not significantly increase.

### 5. E2E Smoke (Playwright)

```bash
pnpm --filter @internal-toolkit/web test:e2e
```

The smoke suite covers login, navigation, and core flows. To add a kiosk-specific smoke test, add a spec to `apps/web/tests/` using the `@playwright/test` framework.

---

## How to Optimize Further

### Bundle Size

The kiosk route (`/washers/app`) is already lean (no recharts, no heavy chart libraries). To verify:

```bash
pnpm --filter @internal-toolkit/web build
# Check .next/analyze (if @next/bundle-analyzer is added) or check server logs for route sizes
```

If the bundle grows, identify what was added:
1. Check that heavy components (recharts, framer-motion) are not imported in `kiosk-client.tsx`
2. Use dynamic imports for any large kiosk-only features

### DB Query Optimization

The daily register uses indexed queries:
```sql
-- Covered by @@index([workspaceId, status, createdAt])
SELECT * FROM WasherTask WHERE workspaceId = ? AND createdAt BETWEEN ? AND ?
```

If queries slow down at scale:
1. Add `@@index([workspaceId, createdAt])` for date-only range queries
2. Add server-side pagination to the daily register (add `page`/`limit` params to the page component)
3. For the export route, consider streaming the CSV for large datasets

### Offline Queue

The current offline queue uses `localStorage` with a 15-second flush interval. If tasks are lost on browser close:
1. Consider upgrading to IndexedDB (larger capacity, more durable)
2. Use the `beforeunload` event to flush synchronously on tab close

### Caching

Read-only endpoints (GET /api/kiosk/tasks) can be cached short-term:
```typescript
// Add to the GET response headers:
headers: { "Cache-Control": "private, max-age=10" }
```

Do NOT add caching to POST/PATCH endpoints.

---

## Monitoring Checklist

After each deployment:
- [ ] `GET /api/health` returns `{ "ok": true, "db": "ok" }`
- [ ] Open `/washers/app` — plate input is auto-focused
- [ ] Enter a plate → task appears instantly (optimistic UI)
- [ ] Check server logs for `kiosk.task_created` event with `durationMs < 200`
- [ ] Verify `X-Request-Id` header is present in kiosk API responses

---

## Regression Playbook

### Symptom: Action buttons (Start/Done/Issue) not working

1. Open browser DevTools → Network
2. Click an action button
3. Look for `PATCH /api/kiosk/tasks/[id]` request
4. If missing: client is not routing to the correct endpoint
5. If 403: `KIOSK_TOKEN` env var mismatch
6. If 404: task ID is stale (task was deleted from DB)

### Symptom: Service checkboxes not saved

1. Check the POST /api/kiosk/tasks request body
2. Verify fields are named `exteriorDone`, `interiorDone`, `vacuumDone` (not `exterior`, etc.)
3. If wrong field names: field name mismatch between client and server schema

### Symptom: Duplicate tasks created

1. Check that `idempotencyKey` is being sent and is a valid UUID
2. Check server logs for `kiosk.task_dedupe_hit` — if absent, the key is different per retry
3. Verify the offline queue reuses the same `idempotencyKey` on retry (not generating a new one)

### Symptom: Kiosk in read-only mode unexpectedly

1. Verify `KIOSK_TOKEN` is set in the server environment
2. Check the `x-kiosk-token` header matches `KIOSK_TOKEN` (exact string comparison)
3. Check server logs for `kiosk_unauthorized_write` security events
