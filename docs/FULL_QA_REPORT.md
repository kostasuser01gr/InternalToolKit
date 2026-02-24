# Full QA Report — InternalToolKit

## Route Coverage

### Auth Routes (no auth required)
| Route | Status | Notes |
|---|---|---|
| `/login` | ✅ Covered | Smoke + a11y + LHCI |
| `/signup` | ✅ Covered | Smoke + a11y |
| `/forgot-password` | ✅ Covered | A11y scan |
| `/reset-password` | ✅ Covered | A11y scan |
| `/accept-invite` | ✅ Covered | Full-scan diagnostic |

### App Routes (auth required)
| Route | Status | Notes |
|---|---|---|
| `/home` | ✅ Covered | Smoke + a11y + full-scan |
| `/overview` | ✅ Covered | Smoke + full-scan |
| `/dashboard` | ✅ Covered | Full-scan |
| `/data` | ✅ Covered | Smoke (CRUD) + a11y + full-scan |
| `/automations` | ✅ Covered | Full-scan + a11y |
| `/assistant` | ✅ Covered | Full-scan + a11y |
| `/chat` | ✅ Covered | Smoke (thread/msg) + a11y + full-scan |
| `/shifts` | ✅ Covered | Smoke (create) + a11y + full-scan |
| `/fleet` | ✅ Covered | Smoke (CRUD) + a11y + full-scan |
| `/washers` | ✅ Covered | A11y + full-scan |
| `/calendar` | ✅ Covered | Smoke (nav) + a11y + full-scan |
| `/analytics` | ✅ Covered | A11y + full-scan |
| `/controls` | ✅ Covered | Full-scan + a11y |
| `/activity` | ✅ Covered | Full-scan + a11y |
| `/reports` | ✅ Covered | Full-scan + a11y |
| `/components` | ✅ Covered | Full-scan + a11y |
| `/notifications` | ✅ Covered | Full-scan + a11y |
| `/settings` | ✅ Covered | Full-scan + a11y |
| `/admin` | ✅ Covered | Smoke (RBAC) + full-scan |
| `/imports` | ✅ Covered | Full-scan + a11y |
| `/feeds` | ✅ Covered | Full-scan + a11y |
| `/ops-inbox` | ✅ Covered | Full-scan + a11y |

### Kiosk Routes
| Route | Status | Notes |
|---|---|---|
| `/washers/app` | ✅ Covered | Full-scan |

### API Endpoints (contract tests)
| Endpoint | Status | Notes |
|---|---|---|
| `/api/health` | ✅ Covered | Status + JSON shape |
| `/api/health/db` | ✅ Covered | Backend status shape |
| `/api/version` | ✅ Covered | Version string |
| `/api/search` | ✅ Covered | Auth-gated response |
| `/api/weather` | ✅ Covered | JSON or config error |
| `/api/activity` | ✅ Covered | Auth-gated response |
| `/api/integrations/status` | ✅ Covered | JSON shape |
| `/api/ai/health` | ✅ Covered | Optional provider |
| `/api/session/logout` | ✅ Covered | No-crash contract |

## Test Suites

| Suite | File | Command |
|---|---|---|
| Smoke E2E | `tests/smoke.spec.ts` | `pnpm -C apps/web test:e2e` |
| Full Diagnostic Scan | `tests/diagnostics/full-scan.spec.ts` | `pnpm -C apps/web test:full-scan` |
| API Contracts | `tests/api-contracts.spec.ts` | `pnpm -C apps/web test:api` |
| Accessibility | `tests/a11y.spec.ts` | `pnpm -C apps/web test:a11y` |
| Unit Tests | `tests/unit/*.test.ts` | `pnpm -C apps/web test:unit` |
| Health Check | `tests/health.spec.ts` | Included in `test:e2e` |

## Diagnostic Full-Scan Features

The full-scan suite (`tests/diagnostics/full-scan.spec.ts`) provides:

1. **Multi-viewport testing** — Desktop (1440×900), Tablet (iPad), Mobile (iPhone 14)
2. **Console error capture** — All `console.error` and `console.warning` logged
3. **Page error detection** — Uncaught exceptions captured via `pageerror` event
4. **Network failure logging** — All HTTP ≥400 responses tracked
5. **Redirect chain tracking** — Detects redirect loops (>8 redirects)
6. **Crash detection** — Looks for 500/error banners
7. **Click audit** — Finds action buttons (Create/Save/Submit/etc) and verifies they produce:
   - Navigation change, OR
   - Network request, OR
   - UI state change
   - Otherwise flagged as `DEAD_ACTION`
8. **Nav link discovery** — Auto-discovers links from sidebar/side-rail/bottom-nav
9. **JSON report** — `test-results/full-scan-report.json`
10. **Traces + screenshots** — Retained on failure

## Root Cause Categories

| ID | Category | Description | Priority |
|---|---|---|---|
| A | Dead buttons | Missing `"use client"` on interactive components | P0 |
| B | Click blocked | Overlay/pointer-events/z-index issues | P0 |
| C | Form submit | Missing `type="button"` causing unintended form submission | P0 |
| D | Auth loops | Middleware redirect loop or wrong matcher | P0 |
| E | Hidden API errors | 401/500 not surfaced to user | P0 |
| F | RBAC denials | Permission logic blocking legitimate actions | P1 |
| G | Env/DB missing | Missing env vars or migrations | P1 |

## Evidence Artifacts

- **Playwright traces**: `apps/web/test-results/*.zip` (on failure)
- **Screenshots**: `apps/web/test-results/*.png` (on failure)
- **Videos**: `apps/web/test-results/*.webm` (on failure)
- **Full-scan JSON report**: `apps/web/test-results/full-scan-report.json`
- **A11y screenshots**: `apps/web/test-results/a11y-*.png`

## How to Run Locally

```bash
# Full E2E smoke suite
pnpm -C apps/web test:e2e

# Diagnostic full scan (all routes × all viewports)
pnpm -C apps/web test:full-scan

# Accessibility scan (HTML pages only)
pnpm -C apps/web test:a11y

# API contract tests
pnpm -C apps/web test:api

# Unit tests
pnpm -C apps/web test:unit

# Everything
pnpm test
```

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs:
1. Lint + typecheck
2. Unit tests
3. E2E smoke tests
4. API contract tests
5. A11y scan
6. Diagnostics full scan (PR only, non-blocking)
7. Build
8. Dependency audit

Artifacts uploaded on failure:
- Playwright traces (7-day retention)
- Full-scan JSON report
- A11y violation screenshots

## Remaining P1/P2 Backlog

| Item | Priority | Acceptance Criteria |
|---|---|---|
| Complete Viber bridge integration test | P1 | Mock Viber API, verify message mirror |
| Kiosk auth token validation E2E | P1 | Test `/washers/app` with valid/invalid kiosk tokens |
| Cron endpoint security tests | P1 | Verify CRON_SECRET gate on `/api/cron/*` |
| PDF export E2E for reports | P2 | Verify `/reports` export produces valid PDF |
| Voice input feature flag test | P2 | Toggle flag, verify UI element appears/disappears |
| Search trigram performance test | P2 | Verify search response time < 500ms |
