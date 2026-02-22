# Cron Jobs

## Vercel Hobby Plan Constraints

Vercel's Hobby plan allows **1 cron job** with a **daily minimum** interval. To work within this limitation, all scheduled tasks are consolidated into a single endpoint.

## Consolidated Daily Endpoint

**Endpoint:** `/api/cron/daily`
**Schedule:** `0 6 * * *` (every day at 06:00 UTC)

### vercel.json Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 6 * * *"
    }
  ]
}
```

## Jobs

The daily cron runs the following jobs sequentially:

| Job | Description |
|-----|-------------|
| Feed scanning | Fetches and scores new items from configured feed sources |
| Weather cache warming | Pre-fetches weather data so dashboard loads are instant |
| Housekeeping | Cleans up stale data (see retention policies below) |
| Automation execution | Runs saved automation rules / shortcuts |
| Feed → Viber mirror | Mirrors matching feed items to the configured Viber channel |

## Security — `CRON_SECRET`

All cron endpoints are protected by the `CRON_SECRET` environment variable. Vercel sends it automatically; manual invocations must include the header:

```
x-cron-secret: <CRON_SECRET value>
```

Requests without a valid secret are rejected with `401 Unauthorized`.

## Retry Helper — `withRetry()`

Each job is wrapped in `withRetry()` which provides **exponential backoff**:

| Attempt | Delay |
|---------|-------|
| 1 | 1 s |
| 2 | 2 s |
| 3 | 4 s |

- **Max delay:** 8 s
- **Max attempts:** 3
- On exhaustion the failure is recorded in the dead-letter queue.

## Database Models

### CronRun

Tracks every cron execution.

| Column | Type | Description |
|--------|------|-------------|
| `job` | string | Job identifier (e.g. `feed-scan`) |
| `startedAt` | datetime | When the job started |
| `finishedAt` | datetime | When the job finished |
| `status` | enum | `success` / `failure` |
| `itemsProcessed` | int | Number of items handled |
| `errorSummary` | string? | Error message if failed |

### DeadLetterEntry

Captures permanently failed work items for manual review.

| Column | Type | Description |
|--------|------|-------------|
| `type` | string | Entry type (e.g. `feed-fetch`, `viber-mirror`) |
| `payload` | json | Original payload that failed |
| `error` | string | Last error message |
| `attempts` | int | Total retry attempts made |
| `lastAttempt` | datetime | Timestamp of last retry |
| `resolvedAt` | datetime? | Set when manually resolved |

## Retention Policies

| Data | Retention |
|------|-----------|
| `CronRun` records | **30 days** — older rows are deleted during housekeeping |
| Resolved `DeadLetterEntry` records | **90 days** after `resolvedAt` |

## Upgrading to Sub-Daily Runs

The Hobby plan only supports daily cron. To run jobs more frequently:

1. **Upgrade the Vercel plan** (Pro supports crons down to every minute).
2. **Use an external scheduler** (e.g. GitHub Actions, Upstash QStash, cron-job.org) that calls `/api/cron/daily` with the `x-cron-secret` header.
