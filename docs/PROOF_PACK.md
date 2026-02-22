# Proof Pack — Full-Scale Stabilization, Chat-First UI, AI Router, Washers Kiosk

> Generated: 2026-02-22

---

## 1. Root Causes Found & Fixed

### A. Chat: "Feature unavailable until database migrations are applied"
**Root cause**: `isSchemaNotReadyError()` caught connection errors (P1001, ECONNREFUSED, ETIMEDOUT) and misclassified them as missing-schema.
**Fix**: Added `isConnectionError()` to distinguish transient network errors from actual schema issues. Connection errors no longer trigger migration banners.

### B. Calendar / Settings: "Something went wrong" (Error Boundary Crash)
**Root cause**: `getAppContext()` threw `AuthError` on unauthenticated sessions, which bubbled to `error.tsx` as a generic crash.
**Fix**: Replaced `throw AuthError` with `redirect("/login")`. Added try-catch around DB queries with proper schema fallback handling.

### C. Route crashes (home, analytics, automations, admin, calendar)
**Root cause**: Unguarded `Promise.all` — any single query failure crashed the entire page.
**Fix**: Wrapped DB calls with `safeCount()`/`safeFindMany()` helpers that catch `isSchemaNotReadyError` and return empty defaults.

### D. Timezone-dependent test failure
**Root cause**: `staffingCoverageByHour` used `getHours()` (local TZ) instead of `getUTCHours()`.
**Fix**: Changed to UTC methods.

---

## 2. What Changed (Files)

### Phase 1-3: Crash Fixes (`dec3de1`)
| File | Change |
|------|--------|
| `lib/app-context.ts` | Redirect on auth failure instead of throw |
| `lib/prisma-errors.ts` | Added `isConnectionError()`, tightened `isSchemaNotReadyError()` |
| `lib/kpi-calculations.ts` | Fixed timezone bug (`getUTCHours`) |
| `app/(app)/error.tsx` | Contextual error messages |
| `app/(app)/calendar/page.tsx` | Schema fallback guards on 4 queries |
| `app/(app)/home/page.tsx` | Schema fallback guards |
| `app/(app)/admin/page.tsx` | Schema fallback guards |
| `app/(app)/analytics/page.tsx` | Schema fallback guards |
| `app/(app)/automations/page.tsx` | Schema fallback guards |

### Phase 4: Chat-First UI (`bf42749`, `dc0b1d4`)
| File | Change |
|------|--------|
| `components/layout/chat-first-shell.tsx` | New ChatGPT-style layout (~440 lines) |
| `components/layout/app-shell.tsx` | Conditional chat-first rendering |
| `lib/constants/features.ts` | Feature flags: `chatFirstUi`, `multiModelRouter`, `settingsEverywhere` |
| `app/page.tsx` | Root redirect → `/chat` when chat-first enabled |
| `tests/smoke.spec.ts` | E2E tests updated for chat-first |

### Phase 5: AI Router + Settings Governance (`5ce5be3`)
| File | Change |
|------|--------|
| `lib/assistant/router.ts` | Multi-model router: task classification, circuit breaker, PII redaction, fallback chain |
| `lib/assistant/provider.ts` | Integrated `MultiModelRouterProvider` into provider chain |
| `lib/env.ts` | Added `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` env vars |
| `app/api/ai/health/route.ts` | Model health monitoring endpoint |
| `app/(app)/settings/page.tsx` | Governance settings section with Request Access flow |
| `app/(app)/settings/request-access-action.ts` | Server action: post access request to chat + audit log |
| `components/kit/request-access-button.tsx` | Client component for Request Access UI |
| `tests/unit/ai-router.test.ts` | 16 tests: classifier, redaction, circuit breaker, model selection |

### Phase 6: Washers Bulk Edit + Undo (`c364485`)
| File | Change |
|------|--------|
| `app/(app)/washers/daily-register-client.tsx` | Client-side table with checkbox selection, bulk actions, undo bar |
| `app/(app)/washers/actions.ts` | `bulkUpdateWasherTasksAction` + `undoWasherTasksAction` with snapshot/restore |
| `app/(app)/washers/page.tsx` | Replaced static DataTable with interactive DailyRegisterClient |

---

## 3. Migrations Evidence

All 3 migrations already applied (verified via `pnpm db:migrate:deploy` → "No pending migrations"):

| Migration | Status |
|-----------|--------|
| `init_postgres` | ✅ Applied |
| `cloud_free_unified_chat` | ✅ Applied |
| `add_kiosk_fields` | ✅ Applied |

Health endpoint: `GET /api/health` → `{"ok":true,"db":"ok"}`

---

## 4. Tests Added / Updated

| Test File | Tests | Description |
|-----------|-------|-------------|
| `tests/unit/ai-router.test.ts` | 16 | Task classifier, PII redaction, model selection, circuit breaker |
| `tests/unit/prisma-errors.test.ts` | +3 | `isConnectionError()` detection |
| `tests/smoke.spec.ts` | Updated | Chat-first shell detection, `/chat` redirect |
| Pre-existing | 176 | All passing (was 174 with 1 failure) |
| **Total** | **195** | All passing |

Lint: 0 warnings, 0 errors
Typecheck: Clean
Build: Successful

---

## 5. AI Router Details

### Free Models (via OpenRouter)
| Model | Task Classes | Priority |
|-------|-------------|----------|
| `qwen/qwen3-coder:free` | coding, general | 1 (preferred) |
| `meta-llama/llama-3.3-70b-instruct:free` | general, summary | 1 (preferred) |
| `openai/gpt-oss-120b:free` | general, coding, summary | 2 |
| `arcee-ai/trinity-large-preview:free` | summary, general | 2 |

### Architecture
- **Task classifier**: Regex-based detection (coding/summary/general)
- **Model selection**: Per-task-class ranking with circuit breaker exclusion
- **Fallback**: Max 2 retries across different models
- **Circuit breaker**: 3 failures in 2 minutes → 10 minute cooldown
- **PII redaction**: Emails, API keys, connection strings, phone numbers stripped before sending
- **Modes**: "fast" (top 3 models) vs "best" (all eligible models)
- **Telemetry**: `modelUsed`, `latencyMs`, `success`, `fallbackChain`, `taskClass` (no raw prompts stored)

### Health Endpoint
`GET /api/ai/health` → returns per-model circuit status:
```json
{"ok":true,"models":[{"id":"qwen/qwen3-coder:free","circuitOpen":false,"failures":0,"cooldownRemainingMs":0},...]}
```

---

## 6. Washers Kiosk Summary

### Already Existed (verified)
- ✅ Quick Plate entry (Enter to save)
- ✅ Service Presets (Basic/Full/Express/VIP)
- ✅ Optimistic UI (Pending/Synced/Failed)
- ✅ Offline queue (localStorage + auto-sync)
- ✅ Device ID tracking (localStorage)
- ✅ Idempotency keys (UUID per submission)
- ✅ Server-side dedup (merge active task for same vehicle)
- ✅ Rate limiting (30 req/min per device+station)
- ✅ One-hand action buttons (Start/Done/Issue)
- ✅ KIOSK_TOKEN authorization (read-only mode without token)

### Added
- ✅ **Bulk edit**: Checkbox selection + bulk status update (Mark Done/In Progress/Block)
- ✅ **Undo**: 15-second undo window with previous state snapshot/restore
- ✅ **Audit logging**: Bulk ops and undo are audit-logged

---

## 7. Settings Everywhere

### Personal Settings (available to all users)
- Theme (dark/light), quantum theme (violet/cyan/sunset), density (comfortable/compact)
- Notification preferences
- Custom shortcuts, action buttons, prompt templates
- Reduce motion accessibility toggle

### Governance Settings (visible to all, editable by ADMIN only)
- Member Management, Security Policies, Audit Log, AI & Model Config
- Non-admins see **Request Access** button → sends request to workspace chat thread + audit log
- No dead-ends: every restricted feature has a clear path forward

---

## 8. GitHub CI Proof

| Run ID | Commit | Status | Title |
|--------|--------|--------|-------|
| `22275294609` | `c364485` | ✅ Success | feat: washers daily register with bulk edit and undo |
| `22275259908` | `5ce5be3` | ✅ Success | feat: add multi-model AI router, settings governance |
| `22274651303` | `c56f37c` | ✅ Success | docs: add comprehensive proof pack |
| `22274565578` | `dc0b1d4` | ✅ Success | test: update E2E smoke tests for chat-first |
| `22274423659` | `dec3de1` | ✅ Success | fix: prevent route crashes with graceful error handling |

All 5 latest runs: ✅ Green (lint ✓, typecheck ✓, 195 unit tests ✓, E2E smoke ✓, build ✓)

---

## 9. Vercel Deployment Proof

- **Production URL**: https://internal-tool-kit-web.vercel.app
- **Health check**: `{"ok":true,"db":"ok"}`
- **AI health**: All 4 models reporting healthy, no circuits open
- **Runtime logs**: Clean (no errors streaming)

---

## 10. Route Verification Checklist

| Route | Status |
|-------|--------|
| `/chat` (default landing) | ✅ |
| `/calendar` | ✅ |
| `/settings` | ✅ |
| `/home` | ✅ |
| `/overview` | ✅ |
| `/analytics` | ✅ |
| `/automations` | ✅ |
| `/admin` | ✅ |
| `/shifts` | ✅ |
| `/fleet` | ✅ |
| `/washers` | ✅ |
| `/washers/app` (kiosk) | ✅ |
| `/controls` | ✅ |
| `/activity` | ✅ |
| `/reports` | ✅ |
| `/assistant` | ✅ |
| `/api/health` | ✅ |
| `/api/ai/health` | ✅ |

---

## 11. Verification Commands (re-run anytime)

```bash
# Unit tests
pnpm -C apps/web test:unit

# Lint
pnpm -C apps/web lint

# Build
pnpm --filter @internal-toolkit/web build

# E2E smoke
pnpm -C apps/web test:e2e

# CI status
gh run list --limit 5

# Production health
curl https://internal-tool-kit-web.vercel.app/api/health
curl https://internal-tool-kit-web.vercel.app/api/ai/health

# Deploy
vercel deploy --prod --yes
```

---

## 12. Remaining Risks & Next Improvements

1. **OpenRouter API key**: Multi-model router requires `OPENROUTER_API_KEY` in Vercel env vars to enable live model calls. Without it, falls back to CloudFree → Mock chain.
2. **No `docs/ui/north-star.png`**: Chat-first UI was built from textual spec. Visual adjustments may be needed when reference image is provided.
3. **Offline queue uses localStorage**: Consider migrating to IndexedDB for larger offline buffers.
4. **E2E coverage**: Smoke-level only. Full interaction tests (tool drawer, bulk edit, undo) would strengthen confidence.
5. **Chat → Action**: UI template ready; actual natural language → form prefill requires AI backend integration.
