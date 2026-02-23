# Incident Baseline Report

## Date: 2026-02-23

## Baseline Gate Results (Phase 0)

| Gate | Result | Notes |
|------|--------|-------|
| `pnpm test:unit` | ✅ PASS | 474/474 tests pass (after `prisma generate`) |
| `pnpm -w typecheck` | ✅ PASS | No type errors |
| `pnpm -w lint` | ✅ PASS | Zero warnings |
| `pnpm --filter @internal-toolkit/web build` | ✅ PASS | All routes compile |
| Playwright e2e | ⏭️ SKIP | Requires running DB |

## Pre-existing Issues

### P0 — Build-blocking / Crash
1. **Prisma client not generated before test** — `pnpm test:unit` fails without `prisma generate` first.
   - Root cause: No pre-test hook for prisma generate.
   - Fix: Add `pretest:unit` script.

### P1 — Error UX
2. **Error boundary shows "Something went wrong" without requestId** — `error.tsx` only shows `error.digest` which is Next.js internal, not the app's `requestId`.
   - Root cause: `mapServerError()` in `lib/server-error.ts` generates `requestId` but it's not surfaced to error boundary.
   - Fix: Pass requestId through error metadata.

3. **Schema fallback pages silently degrade** — Settings, calendar, chat, imports, feeds, washers all silently return empty data when schema is not ready, no user feedback.
   - Root cause: `isSchemaNotReadyError()` catches but doesn't surface warning.
   - Fix: Add schema-not-ready banner component.

### P2 — Missing Features
4. **Imports: No ImportChangeSet model** — Rollback not possible without change-set tracking.
5. **Fleet: No formal state machine** — Vehicle has `VehicleStatus` enum but no pipeline states.
6. **Weather: No WeatherCache model** — Weather data not persisted.
7. **Chat: Missing edit/delete, reactions UI, presence** — Schema exists but UI not complete.
8. **Search: No FTS indexes in schema** — pg_trgm and tsvector not configured.

### P3 — Nice-to-have
9. **Kiosk token partially visible** — Token redaction uses simple `***`.
10. **Device fingerprint hash truncated to 24 chars** — Low collision risk but not ideal.
11. **Cron automation schedule matching is naive** — String comparison instead of cron parser.

## Classification Summary

| Category | Count | Items |
|----------|-------|-------|
| Build/Env | 1 | #1 |
| Error UX | 2 | #2, #3 |
| Missing Schema | 3 | #4, #6, #8 |
| Missing Features | 2 | #5, #7 |
| Security/Polish | 3 | #9, #10, #11 |
