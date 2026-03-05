# Desktop System Scan Failure Notes

## Scope
Repro target: `apps/web/tests/diagnostics/system-scan-v2.spec.ts` on Desktop.

## Initial evidence (previous failing run)
Evidence bundle:
- `apps/web/test-results/diagnostics-system-scan-v2-42daf-primary-actions-are-healthy-Desktop/trace.zip`
- `apps/web/test-results/diagnostics-system-scan-v2-42daf-primary-actions-are-healthy-Desktop/error-context.md`
- Route screenshots under `apps/web/test-results/diagnostics-system-scan-v2-42daf-primary-actions-are-healthy-Desktop/system-scan/`

## Findings
1. `/fleet`, `/washers`, `/settings`, `/notifications` timeout failures
- Cause category: scanner wait strategy too strict/unstable for route readiness.
- Evidence: `page.goto(..., waitUntil: "load"/"domcontentloaded")` timeouts captured in desktop scan failure output and trace.
- Fix: scanner now uses deterministic route readiness (`gotoRouteWithReadyState`) with per-route ready selectors and longer bounded navigation/ready timeouts.

2. `/overview` dead action (`Build and run automations`)
- Cause category: action-effect detection timing too tight for link navigation under slower Desktop runs.
- Evidence: dead-action report entry for `/overview` in failed system-scan report.
- Fix: increased navigation wait window for action detection and added explicit regression coverage on `/overview` quick-access automation link.

3. Hydration mismatch error visible on `/notifications`
- Cause category: client-side attribute drift in shell search input during hydration.
- Evidence: console hydration mismatch message collected in desktop scanner output.
- Fix: added `suppressHydrationWarning` on the chat-first global search input and scanner-level hydration mismatch detection.

## Post-fix validation commands
```bash
cd /Users/user/projects/InternalToolKit-ops/apps/web
pnpm exec playwright test tests/diagnostics/system-scan-v2.spec.ts --project Desktop --reporter=line
pnpm exec playwright test tests/diagnostics/system-scan-v2.spec.ts --project Mobile --reporter=line
```
