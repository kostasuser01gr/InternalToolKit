# Next Steps — Gap Analysis

> Updated: 2026-02-22 (Wave 7)

## Current State Summary

| Module | Status | Notes |
|---|---|---|
| Weather Feed | ✅ Done | Open-Meteo, 10min cache, 5 stations, widget on Home |
| Feeds Module | ✅ Done | RSS/Atom scanner, 5 categories, relevance scoring, cron, auto-pin |
| Global Search | ✅ Done | 7 entity types, debounced, RBAC-safe, command palette |
| Quick Bar | ✅ Done | User shortcuts + role defaults + admin recommended per-role |
| Inline Edit | ✅ Done | Generic component + fleet mileage/fuel/notes + shift title |
| Virtual Tables | ✅ Done | Fleet, activity, washers (task queue + register), feeds |
| Optimistic UI | ✅ Done | Washers task status, shifts bulk, feeds pin toggle |
| Viber Mirror | ✅ Done | Channel Post API + Bot API fallback, multi-channel, PII redaction |
| Setup Wizard | ✅ Done | Settings → Integrations with test connection |
| Ops Inbox | ✅ Done | Feed alerts + shift requests + incidents + notifications |
| Loading Skeletons | ✅ Done | 9 routes with loading.tsx |
| Route Prefetch | ✅ Done | requestIdleCallback prefetch of 7 core routes |
| Undo Toast | ✅ Done | Floating undo button with 15s TTL |
| Daily Cron | ✅ Done | Consolidated: feeds + weather warm + housekeeping |
| Cron Run Persistence | ✅ Done | CronRun table in DB, 30-day retention, housekeeping cleanup |
| Dead-Letter Persistence | ✅ Done | DeadLetterEntry table, DB-backed retry, resolved cleanup |
| Role Shortcuts Admin | ✅ Done | Settings → per-role shortcut editor (ADMIN only) |
| Feed Auto-pin | ✅ Done | relevanceScore ≥ 0.8 → auto-pin + admin notification |
| Mobile UX | ✅ Done | Bottom nav, no overflow, tool drawer quick actions |

## Vercel Hobby Plan Blocker

**Limitation**: Vercel Hobby plan allows **1 cron job** with **daily** minimum frequency.

**Workaround**: Single consolidated `/api/cron/daily` endpoint that runs:
1. Feed source scanning (up to 20 sources) with ETag/If-Modified-Since
2. Weather cache warming (all 5 stations)
3. Housekeeping (90-day feed retention, 30-day cron log retention, dead-letter retry + resolved cleanup)

**To enable sub-daily scanning**: Upgrade to Vercel Pro (10 crons, per-minute frequency) or use an external scheduler (GitHub Actions, Supabase pg_cron, etc.) to call the endpoint more frequently.

## Data Models (All Existing)

- **FeedSource**: name, url, type, isActive, scanIntervalMin, lastScannedAt, lastEtag
- **FeedItem**: sourceId, title, summary, url, urlHash, category, relevanceScore, keywords, isPinned
- **Station**: lat, lon, name, code (coordinates for weather)
- **UserShortcut**: userId, workspaceId, label, command, keybinding
- **UserActionButton**: userId, workspaceId, label, action, position
- **CronRun**: job, startedAt, finishedAt, status, itemsProcessed, errorSummary (Wave 7)
- **DeadLetterEntry**: type, payload, error, attempts, lastAttempt, resolvedAt (Wave 7)

## Feature Implementation Map

| Phase | Feature | Status | Key Files |
|---|---|---|---|
| 1 | Vercel Cron Foundation | ✅ | `vercel.json`, `app/api/cron/daily/route.ts` |
| 2 | Weather Feed | ✅ | `lib/weather/client.ts`, `components/widgets/weather-widget.tsx` |
| 3 | Feeds Module | ✅ | `app/(app)/feeds/`, `lib/feeds/scanner.ts`, `feed-items-table.tsx` |
| 4 | Viber Mirror | ✅ | `lib/viber/bridge.ts`, `app/api/viber/route.ts` |
| 5 | Global Search | ✅ | `app/api/search/route.ts`, `components/layout/command-palette.tsx` |
| 6 | User Shortcuts | ✅ | `components/layout/quick-bar.tsx`, `app/v1/shortcuts/` |
| 7 | Performance | ✅ | VirtualTable, InlineEdit, optimistic UI, prefetch |
| 8 | Setup Wizard | ✅ | `components/settings/integrations-wizard.tsx` |
| 9 | Persistence | ✅ | CronRun + DeadLetterEntry models, DB-backed logging |

## Acceptance Criteria (All Met)

1. ✅ Weather widget renders on Home, shows cached data, never crashes
2. ✅ Feeds page shows items with category chips, pin/send-to-chat actions
3. ✅ Feed auto-pin for high-relevance items (≥ 0.8 score)
4. ✅ Global search returns results across 7 entity types with RBAC
5. ✅ Quick Bar shows user shortcuts + role-recommended suggestions
6. ✅ Role shortcuts configurable per-role by admin in Settings
7. ✅ Inline edit works in fleet and shifts with undo support
8. ✅ VirtualTable used in fleet, activity, washers, feeds, daily register
9. ✅ Optimistic UI for task status, shift bulk, feed pin
10. ✅ Undo toast appears after destructive actions
11. ✅ Viber mirror supports Channel Post API with fallback
12. ✅ Dead-letter entries persisted in DB with retry and cleanup
13. ✅ Cron run logs persisted in DB with 30-day retention
14. ✅ Integrations wizard detects missing keys and tests connections
15. ✅ Ops Inbox aggregates feed alerts + shift requests + incidents

## Next Moves (After This Run)

1. Add Automations 2.0 rules (if feed severity high → pin to chat → mirror to Viber)
2. Upgrade Vercel to Pro for sub-daily cron scheduling
3. Add A/B tuning for feed relevance scoring (reduce noise)
4. Add station-level feature flags and staged rollout
5. Add Viber inbound (two-way mode) for washer replies
