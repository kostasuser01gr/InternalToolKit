# Proof Pack — Final Stabilization Pass

Date: 2026-03-05
Repo: `kostasuser01gr/InternalToolKit`

## 1) What was failing
- CI run `22684653845` failed in `quality` job (`E2E smoke tests`).
- Exact failures from logs:
  - `apps/web/tests/smoke.spec.ts` chat flow expected `Message sent.` but did not reliably appear.
  - Shared login helpers in `apps/web/tests/smoke.spec.ts` and `apps/web/tests/modules.spec.ts` intermittently remained on `/login`.
  - `system-scan-v2` initially timed out on Mobile and flagged `/shifts` export as a false dead action.
- Runtime server error observed during e2e logs:
  - `Cookies can only be modified in a Server Action or Route Handler` from `apps/web/app/(app)/layout.tsx`.

## 2) Root-cause fixes applied
- Deterministic login retries in e2e shared helpers.
  - `apps/web/tests/smoke.spec.ts`
  - `apps/web/tests/modules.spec.ts`
- Chat smoke flow now validates thread creation + send outcome deterministically via URL/query semantics and message presence.
  - `apps/web/tests/smoke.spec.ts`
- Removed invalid cookie mutation from server component layout (eliminates runtime server exception).
  - `apps/web/app/(app)/layout.tsx`
- Scanner v2 implemented without duplicated scanner logic:
  - Added report-file parameterization in scanner core.
  - Added `system-scan-v2.spec.ts` wrapper.
  - Added `test:system-scan:v2` script.
  - Improved scanner runtime + action effect detection for export/download actions.
  - Files:
    - `apps/web/tests/diagnostics/system-scan.spec.ts`
    - `apps/web/tests/diagnostics/system-scan-v2.spec.ts`
    - `apps/web/package.json`
- CI failure triage evidence doc added:
  - `docs/CI_QUALITY_FAIL.md`

## 3) Local verification run (post-fix)
Commands run successfully:
- `pnpm -w lint`
- `pnpm -w typecheck`
- `pnpm -w test`
- `pnpm --filter @internal-toolkit/web build`
- `cd apps/web && pnpm exec playwright test tests/smoke.spec.ts tests/modules.spec.ts --project Desktop --project Mobile --reporter=line`
- `cd apps/web && pnpm test:system-scan:v2`
- `cd apps/web && pnpm test:api-system`

## 4) System-scan-v2 result
Report: `apps/web/test-results/system-scan-v2-report.json`
- Total route entries: `64`
- Projects covered: `desktop=32`, `mobile=32`
- Failing routes: `0`
- Dead actions: `0`
- 500-route failures: `0`
- Redirect loops: `0`
- Error-boundary banner hits: `0`

## 5) CI/Deploy verification status
- GitHub Actions run ID(s): _to be filled after push/watch_
- Vercel production verification: _to be filled after deploy/log check_

## 6) Re-run checklist
- `pnpm -w lint && pnpm -w typecheck && pnpm -w test && pnpm --filter @internal-toolkit/web build`
- `cd apps/web && pnpm exec playwright test tests/smoke.spec.ts tests/modules.spec.ts --project Desktop --project Mobile`
- `cd apps/web && pnpm test:system-scan:v2`
- `cd apps/web && pnpm test:api-system`
