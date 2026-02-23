# Incident Baseline Report

## Date: 2026-02-23 (Updated after Wave 12 + Connection Wiring)

## Baseline Gate Results (Phase 0)

| Gate | Result | Notes |
|------|--------|-------|
| `pnpm test:unit` | ✅ PASS | 556/556 tests pass |
| `pnpm typecheck` | ✅ PASS | No type errors |
| `pnpm lint` | ✅ PASS | Zero warnings |
| `pnpm build` | ✅ PASS | 57 static pages, all routes compile |
| Vercel deploy | ✅ PASS | Production live |
| CI (GitHub Actions) | ✅ PASS | Last 4 runs green |
| Supabase migrations | ✅ PASS | 12 migrations applied, schema up to date |
| Cloudflare Worker | ✅ PASS | Deployed at workers.dev |

## Remaining Gaps (Post Wave 12)

### P1 — Functional Gaps

| # | Module | Gap | Impact |
|---|--------|-----|--------|
| 1 | **Imports** | Bookings apply logic missing (only fleet apply works) | Bookings import → preview works but Accept does nothing |
| 2 | **Fleet** | No priority queue sorting by `needByAt` | Can't prioritize urgent turnarounds |
| 3 | **Chat** | No voice notes UI (field exists as generic attachment) | Missing Viber parity feature |
| 4 | **Chat** | Edit/delete limited to author/admin (no "for everyone") | Admin needs ability to clean any message |
| 5 | **Search** | No Postgres FTS (only pg_trgm similarity) | No full-text search for long messages/feeds |
| 6 | **Feeds** | No rate limiting in cron scanner | Could hammer external RSS sources |
| 7 | **Stability** | No middleware.ts for auth/rate limiting | All routes accessible without early rejection |

### P2 — Polish/Enhancement

| # | Module | Gap | Impact |
|---|--------|-----|--------|
| 8 | **Fleet** | QC checklist JSON schema undefined | No type safety for checklist items |
| 9 | **Chat** | Message search partial (search route exists but limited) | Can't search within conversations |
| 10 | **Feeds** | No internal retry/dead-letter for failed cron | Vercel doesn't retry failed crons |

### P3 — Already Complete (Wave 12)

- ✅ ImportBatch + ImportChangeSet models with rollback
- ✅ XLSX/CSV/JSON/TXT parsing with diff preview
- ✅ Fleet state machine (RETURNED→CLEANING→QC→READY)
- ✅ QC pass/fail + incidents + keys/docs tracking
- ✅ SLA breach detection in housekeeping cron
- ✅ Washers: KPIs, queue, daily register, export, bulk edit
- ✅ Washers PWA: token auth, quick plate, presets, offline queue, QR share
- ✅ Chat: channels/DMs/groups, replies, pins, mentions, reactions, read receipts
- ✅ Viber bridge outbound mirror
- ✅ Feeds: RSS scanning, ETag/dedupe, severity scoring, Ops Inbox
- ✅ Weather: geolocation + station fallback + Open-Meteo + stale badge
- ✅ Shortcuts: per-user quick bar, role defaults, inline/bulk/undo
- ✅ Error correlation (requestId/errorId)
- ✅ Env validation scripts (env:check, env:setup)
- ✅ Connection wiring (Vercel + Supabase + Cloudflare)

## Classification Summary

| Category | Count |
|----------|-------|
| Functional gaps | 7 |
| Polish items | 3 |
| Already complete | 14+ features |
