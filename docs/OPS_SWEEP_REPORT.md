# OPS SWEEP — FINAL PROOF REPORT

Continuous Stabilization + Verification + Deployment Sweep  
Date: 2026-02-21

---

## 1. Root Causes Found

### `/settings` crash ("Something went wrong") — P2021
**Cause**: Migration `20260220181000_cloud_free_unified_chat` was not applied to the
production Supabase database. Tables `UserShortcut`, `UserActionButton`, and
`PromptTemplate` did not exist. `settings/page.tsx` called `findMany()` on these tables
without error handling, causing an unhandled Prisma P2021 exception that propagated to
the `error.tsx` boundary ("Something went wrong").

### `/assistant` crash — P2022
**Cause**: Same missing migration. `ChatMessage` lacks columns `modelId`, `latencyMs`,
`tokenUsage`, `status`, `commandName`, `isPinned` added by the migration. The assistant
page called `chatThread.findFirst({ include: { messages: ... } })` which selected these
columns — P2022.

### `/washers` + `/calendar` crashes — P2022
**Cause**: Same missing migration causing Prisma's query engine enum/schema validation
failure when querying `washerTask.findMany`. Returns P2022 with column `(not available)`.

### Vercel build migration — P1001
**Cause**: The Supabase direct connection URI (port 5432) is not reachable from Vercel's
build machines in Washington DC. The `migrate-deploy.mjs` script exits with code 1 when
P1001 occurs, blocking the build.

---

## 2. Fixes Applied

| File | Change |
|------|--------|
| `apps/web/vercel.json` (new) | Added `buildCommand` that runs `migrate-deploy.mjs` (soft, continues on network failure) before `pnpm run build`. Future deployments will apply migrations when DB is reachable. |
| `apps/web/app/(app)/settings/page.tsx` | Added `import { isSchemaNotReadyError }`. Wrapped `UserShortcut.findMany`, `UserActionButton.findMany`, `PromptTemplate.findMany` with `.catch(schemaFallback([]))` — returns empty arrays instead of crashing when tables are missing (P2021/P2022). |
| `apps/web/app/(app)/assistant/page.tsx` | Added `import { isSchemaNotReadyError }`. Wrapped `chatThread.findFirst(include:messages)` with `.catch()` — returns `null` on P2022; page renders without thread history instead of crashing. |
| `apps/web/app/(app)/washers/page.tsx` | Added `import { isSchemaNotReadyError }`. Wrapped both `washerTask.findMany` calls with `.catch()` — returns `[]` on P2022; page shows empty task list instead of crashing. |
| `apps/web/app/(app)/calendar/page.tsx` | Added `import { isSchemaNotReadyError }`. Wrapped `washerTask.findMany` with `.catch()` — returns `[]` on P2022; calendar renders without washer events instead of crashing. |

---

## 3. Tests Added / Updated

| File | Tests | Description |
|------|-------|-------------|
| `apps/web/tests/unit/settings-schema-guard.test.ts` (new) | 7 | Regression tests for `isSchemaNotReadyError` and `isPrismaKnownErrorCode` covering P2021, P2022, P2025, unrelated errors, and non-Error values. Ensures schema fallback guard only swallows migration errors and re-throws all others. |

---

## 4. CI Evidence

### Latest GitHub Actions Runs

| Commit | Workflow | Status |
|--------|----------|--------|
| `a4e7de0` — fix: resilient migration | CI (main) | ✅ green (4m17s) |
| `58c2d2a` — fix: guard pages | CI (main) | ✅ green (4m11s) |
| `e3ff949` — prior merge | CI (main) | ✅ green (4m4s) |

GH Runs URL: `https://github.com/kostasuser01gr/InternalToolKit/actions`

---

## 5. Vercel Evidence

### Deployment URL
**Production**: https://internal-tool-kit-himntvkuo-kostasuser01gr.vercel.app  
**Alias**: https://internal-tool-kit-web.vercel.app  

### Build Log Summary
```
Running "node scripts/migrate-deploy.mjs || echo '[warn] migrate-deploy failed...' ; pnpm run build"
→ Prisma migrate (soft-fails on P1001 — Supabase unreachable from build machine)
→ prisma generate ✓
→ next build ✓
→ All routes compiled (dynamic server-rendered)
→ Build Completed in ~45s
→ Deployment completed — Status: ● Ready
```

### Runtime Logs (post-deploy)
No new P2021 / P2022 errors observed in the first minutes after deployment.
Previous errors (before fix):
- `/settings` → P2021: UserShortcut/PromptTemplate tables missing
- `/assistant` → P2022: ChatMessage column missing
- `/washers` → P2022: washerTask column error
- `/calendar` → P2022: washerTask column error

Post-fix behavior: pages render with empty lists / null fallbacks instead of crashing.

---

## 6. Verification Checklist

| Check | Status |
|-------|--------|
| `/settings` loads without crash (schema fallback active) | ✅ |
| `/assistant` loads without crash (null thread fallback) | ✅ |
| `/washers` loads without crash (empty task list fallback) | ✅ |
| `/calendar` loads without crash (no washer events fallback) | ✅ |
| No "Something went wrong" panels on core routes | ✅ |
| Typecheck passes | ✅ |
| Lint passes (0 warnings) | ✅ |
| Unit tests: 47 passed (1 pre-existing failure unrelated to fix) | ✅ |
| Build passes | ✅ |
| CI green | ✅ |
| Vercel deployment: Ready | ✅ |

---

## 7. Remaining Risks & Next Improvements

### P0 — Migration must be applied manually to production

The migration `20260220181000_cloud_free_unified_chat` is still not applied to the
production Supabase database. Features that depend on the new tables and columns
(UserShortcut, PromptTemplate, ChatMessage.isPinned etc.) will not work in production
until the migration is applied.

**Action required**:
1. Un-pause the Supabase project (if on free tier and auto-paused)
2. From a machine with network access to Supabase, run:
   ```bash
   cd apps/web
   DIRECT_URL="<your-supabase-direct-url>" pnpm db:migrate:deploy
   ```
3. Or add the Supabase IP allow-list to include Vercel build server IPs so automated
   migration in `vercel.json` works.

### Improvement — CI-based migration for production

Consider adding a GitHub Actions job triggered after `main` CI passes that deploys the
migration to production Supabase using stored secrets (`PROD_DIRECT_URL`). This removes
the dependency on Vercel build network access.

### Known pre-existing test failure

`tests/unit/kpi-calculations.test.ts::staffingCoverageByHour::counts employees per hour`  
Assertion mismatch (expected 1, received 0). Not introduced by this sweep. Tracked
separately.

### Dependabot / GHAS not enabled

Security scanning is not configured. Recommend enabling Dependabot and code scanning
via GitHub repository settings.
