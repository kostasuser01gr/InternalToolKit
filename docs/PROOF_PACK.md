# Proof Pack — Stabilization & Chat-First UI

## 1. What Was Broken + Root Causes

### Chat: "Feature unavailable until database migrations are applied"
**Root cause**: `isSchemaNotReadyError()` in `lib/prisma-errors.ts` was overly broad — it caught connection errors (ECONNREFUSED, ETIMEDOUT, P1001) and misclassified them as missing-schema errors, triggering the migration banner even though all 3 migrations were already applied.

**Fix**: Added `isConnectionError()` function and excluded connection errors from `isSchemaNotReadyError()`. Connection errors now surface as transient failures, not schema issues.

### Calendar / Settings: "Something went wrong" (Error Boundary Crash)
**Root cause**: `getAppContext()` in `lib/app-context.ts` called `requireAuthUser()` and threw `AuthError` on unauthenticated requests. This error bubbled up to the `error.tsx` boundary, displaying a generic "Something went wrong" panel instead of redirecting to `/login`.

**Fix**: Replaced `throw AuthError` with `redirect("/login")` on auth failure. Added try-catch around DB queries with proper schema fallback handling.

### Other route crashes (home, analytics, automations, admin)
**Root cause**: Unguarded `Promise.all` over multiple Prisma queries — if any single query failed (schema/connection), the entire page crashed.

**Fix**: Wrapped all DB calls with `safeCount()` / `safeFindMany()` helpers that catch `isSchemaNotReadyError` and return empty defaults. Applied to calendar, home, analytics, automations, and admin pages.

### Pre-existing test failure
**Root cause**: `staffingCoverageByHour` in `lib/kpi-calculations.ts` used `getHours()`/`getMinutes()` (local timezone) instead of `getUTCHours()`/`getUTCMinutes()`, causing CI failures in non-UTC environments.

**Fix**: Changed to UTC methods.

---

## 2. Files Changed

### Crash Fixes (commit `dec3de1`)
| File | Change |
|------|--------|
| `apps/web/lib/app-context.ts` | Redirect on auth failure instead of throw |
| `apps/web/lib/prisma-errors.ts` | Added `isConnectionError()`, tightened `isSchemaNotReadyError()` |
| `apps/web/lib/kpi-calculations.ts` | Fixed timezone bug (`getUTCHours`) |
| `apps/web/app/(app)/error.tsx` | Contextual error messages (auth vs DB vs generic) |
| `apps/web/app/(app)/calendar/page.tsx` | Schema fallback guards on all 4 queries |
| `apps/web/app/(app)/home/page.tsx` | Schema fallback guards |
| `apps/web/app/(app)/admin/page.tsx` | Schema fallback guards |
| `apps/web/app/(app)/analytics/page.tsx` | Schema fallback guards |
| `apps/web/app/(app)/automations/page.tsx` | Schema fallback guards |
| `apps/web/tests/unit/prisma-errors.test.ts` | Added `isConnectionError` tests |

### Chat-First UI (commit `bf42749`)
| File | Change |
|------|--------|
| `apps/web/components/layout/chat-first-shell.tsx` | New ChatGPT-style layout (~440 lines) |
| `apps/web/components/layout/app-shell.tsx` | Conditional chat-first rendering |
| `apps/web/lib/constants/features.ts` | Added `chatFirstUi` feature flag |
| `apps/web/app/page.tsx` | Root redirect → `/chat` when chat-first enabled |

### E2E Test Fix (commit `dc0b1d4`)
| File | Change |
|------|--------|
| `apps/web/tests/smoke.spec.ts` | Updated for chat-first layout detection |

---

## 3. Migrations Evidence

All 3 migrations were already applied before this work:

| Migration | Status |
|-----------|--------|
| `init_postgres` | Applied |
| `cloud_free_unified_chat` | Applied |
| `add_kiosk_fields` | Applied |

Verified via: `pnpm db:migrate:deploy` → "No pending migrations to apply"

Health endpoint: `GET /api/health` → `{"ok":true,"db":"ok"}`

---

## 4. Tests Added / Updated

- **Unit tests**: 179/179 passing (was 174 with 1 failure)
  - Added 3 tests for `isConnectionError()` in `prisma-errors.test.ts`
  - Fixed 1 pre-existing failure in `kpi-calculations` (timezone)
- **E2E smoke tests**: Updated to handle both classic and chat-first shell layouts
- **Lint**: 0 warnings, 0 errors
- **Typecheck**: Clean

---

## 5. GitHub CI Proof

| Run ID | Commit | Status | Title |
|--------|--------|--------|-------|
| `22274565578` | `dc0b1d4` | ✅ Success | test: update E2E smoke tests for chat-first UI shell compatibility |
| `22274479543` | `bf42749` | ❌ Failure | feat: add ChatGPT-style chat-first UI layout (E2E expected old shell) |
| `22274423659` | `dec3de1` | ✅ Success | fix: prevent route crashes with graceful error handling |
| `22264224902` | `042abf5` | ✅ Success | docs: add OPS sweep baseline and final proof report |
| `22264127032` | `a4e7de0` | ✅ Success | fix: make Vercel build resilient to migration network failures |

Latest CI (`dc0b1d4`): All steps green — lint ✓, typecheck ✓, unit tests ✓, E2E smoke ✓, build ✓

---

## 6. Vercel Deployment Proof

- **Production URL**: https://internal-tool-kit-web.vercel.app
- **Deployment ID**: `dpl_2HNaYx3FUQdHRYEgAFszrU3rnXQB`
- **Health check**: `{"ok":true,"db":"ok"}`
- **Runtime logs**: No errors streaming (clean)
- **Vercel user**: `kostasuser01gr`

---

## 7. Verification Checklist

| Route | Status | Notes |
|-------|--------|-------|
| `/chat` | ✅ | Default landing page (chat-first mode) |
| `/calendar` | ✅ | Schema fallback guards, no crash |
| `/settings` | ✅ | Auth redirect instead of crash |
| `/home` | ✅ | Schema fallback guards |
| `/overview` | ✅ | Loads correctly |
| `/analytics` | ✅ | Schema fallback guards |
| `/automations` | ✅ | Schema fallback guards |
| `/admin` | ✅ | Schema fallback guards |
| `/shifts` | ✅ | Loads correctly |
| `/fleet` | ✅ | Loads correctly |
| `/washers` | ✅ | Loads correctly |
| `/controls` | ✅ | Loads correctly |
| `/activity` | ✅ | Loads correctly |
| `/reports` | ✅ | Loads correctly |
| `/assistant` | ✅ | Loads correctly |
| `/api/health` | ✅ | `{"ok":true,"db":"ok"}` |

### Chat-First UI
- Left rail with module shortcuts: ✅
- Center content area: ✅
- Right tool drawer: ✅
- Top bar (search + profile): ✅
- Mobile bottom nav: ✅
- Feature flag toggle (`NEXT_PUBLIC_FEATURE_CHAT_FIRST_UI`): ✅

---

## 8. Remaining Risks & Next Improvements

1. **No `docs/ui/north-star.png`**: The chat-first UI was built from the textual spec. If the reference image is added later, visual adjustments may be needed.
2. **E2E test coverage**: Currently smoke-level only. Full interaction tests (open tool drawer, create via chat, mobile bottom sheet) would strengthen confidence.
3. **Connection error UX**: Connection errors now show a generic error state. A "Retrying…" pattern would improve UX for transient DB issues.
4. **Feature flag persistence**: `chatFirstUi` defaults to ON. Production can disable via `NEXT_PUBLIC_FEATURE_CHAT_FIRST_UI=0` in Vercel env vars.
5. **Chat AI integration**: The chat-first shell is a UI template. Actual "Chat → Action" behavior (e.g., natural language → form fill) requires AI backend work.
