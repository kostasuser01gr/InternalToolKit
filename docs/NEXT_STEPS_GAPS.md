# Next Steps — Gap Analysis

> Generated: 2026-02-22

## Current State Summary

| Module | Status | Notes |
|---|---|---|
| Weather Feed | ✅ Done | Open-Meteo, 10min cache, 5 stations, widget on Home |
| Feeds Module | ✅ Done | RSS/Atom scanner, 5 categories, relevance scoring, cron |
| Global Search | ✅ Done | 7 entity types, debounced, RBAC-safe |
| Quick Bar | ✅ Done | User shortcuts + role defaults + recommended adopt |
| Inline Edit | ✅ Done | Generic component with optimistic UI + undo stack |
| Virtual Tables | ✅ Done | @tanstack/react-virtual wrapper |
| Viber Mirror | ✅ Done | Channel Post API + Bot API fallback, multi-channel |
| Setup Wizard | ✅ Done | Settings → Integrations with test connection |
| Loading Skeletons | ✅ Done | 9 routes with loading.tsx |
| Route Prefetch | ✅ Done | requestIdleCallback prefetch of 7 core routes |
| Undo Toast | ✅ Done | Floating undo button with 15s TTL |
| Daily Cron | ✅ Done | Consolidated: feeds + weather warm + housekeeping |

## Vercel Hobby Plan Blocker

**Limitation**: Vercel Hobby plan allows **1 cron job** with **daily** minimum frequency.

**Workaround**: Single consolidated `/api/cron/daily` endpoint that runs:
1. Feed source scanning (up to 20 sources)
2. Weather cache warming (all 5 stations)
3. Housekeeping (90-day feed retention, Viber dead-letter retry)

**To enable sub-daily scanning**: Upgrade to Vercel Pro (10 crons, per-minute frequency) or use an external scheduler (GitHub Actions, Supabase pg_cron, etc.) to call the endpoint more frequently.

## Data Models (Existing)

- **FeedSource**: name, url, type, isActive, scanIntervalMin, lastScannedAt, lastEtag
- **FeedItem**: sourceId, title, summary, url, urlHash, category, relevanceScore, keywords, isPinned
- **Station**: lat, lon, name, code (coordinates for weather)
- **UserShortcut**: userId, workspaceId, label, command, keybinding
- **UserActionButton**: userId, workspaceId, label, action, position

## Acceptance Criteria

1. ✅ Weather widget renders on Home, shows cached data, never crashes
2. ✅ Feeds page shows items with category chips, pin/send-to-chat actions
3. ✅ Global search returns results across 7 entity types with RBAC
4. ✅ Quick Bar shows user shortcuts + role-recommended suggestions
5. ✅ Inline edit component available for tables
6. ✅ VirtualTable component available for large datasets
7. ✅ Undo toast appears after destructive actions
8. ✅ Viber mirror supports Channel Post API with fallback
9. ✅ Integrations wizard detects missing keys and tests connections
10. ✅ Daily cron runs feeds + weather + housekeeping

## Risk List

| Risk | Mitigation |
|---|---|
| Vercel Hobby cron limit | Consolidated endpoint; document Pro upgrade path |
| Feed source downtime | ETag/If-Modified-Since; graceful skip with error logging |
| Viber API rate limits | 20 msg/min rate limiter; dead-letter queue with bounded retry |
| Weather API failure | Stale-while-revalidate cache; null-safe fallback |
| Large table performance | @tanstack/react-virtual with overscan=10 |
