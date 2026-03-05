# Proof Pack — Final Stabilization + Railway Backend Migration

Date: 2026-03-05
Repo: `kostasuser01gr/InternalToolKit`

## 1) Scope Completed
- Stability and diagnostics hardening verified locally and via Playwright.
- Backend moved to Railway (`internal-toolkit-api`) with successful deployment.
- Frontend remains on Vercel and now points API client base URL to Railway.
- Convex compatibility preserved (`codegen` + prod deploy successful).

## 2) Code and Config Changes
- Added Node server entrypoint for API service hosting on Railway:
  - `apps/api/src/server.ts`
- Refactored API worker entry to expose shared request handler for Worker + Node server:
  - `apps/api/src/index.ts`
- Added Railway-compatible runtime dependencies/scripts:
  - `apps/api/package.json`
  - `apps/api/tsconfig.json`
- Added monorepo-root Railway deployment config:
  - `railway.toml`
- Removed app-local Railway config to avoid duplicate deployment rules:
  - removed `apps/api/railway.toml`
- Updated lockfile after dependency changes:
  - `pnpm-lock.yaml`
- Baseline artifact updated:
  - `docs/BASELINE_STATUS.md`

## 3) Local Verification (Passed)
Executed successfully:
- `pnpm -w lint`
- `pnpm -w typecheck`
- `pnpm -w test`
- `pnpm --filter @internal-toolkit/web build`

Playwright (explicit):
- `cd apps/web && pnpm exec playwright test tests/smoke.spec.ts --project Desktop --reporter=line`
- `cd apps/web && pnpm exec playwright test tests/modules.spec.ts --project Desktop --reporter=line`
- `cd apps/web && pnpm exec playwright test tests/diagnostics/system-scan-v2.spec.ts --project Desktop --reporter=line`
- `cd apps/web && pnpm exec playwright test tests/diagnostics/system-scan-v2.spec.ts --project Mobile --reporter=line`
- `pnpm -C apps/web test:system-scan:v2`

## 4) Diagnostics Report Result (system-scan-v2)
Report file:
- `apps/web/test-results/system-scan-v2-report.json`

Verified summary:
- desktop routes: `32`
- mobile routes: `32`
- failing routes: `0`
- dead actions: `0`
- HTTP 500 findings: `0`
- redirect loops: `0`
- "Something went wrong" banners: `0`
- hydration mismatch flags: `0`

## 5) Backend on Railway (Passed)
Railway project/service:
- Project: `internal-toolkit-api`
- Service: `internal-toolkit-api`
- Latest successful deployment: `011d20d8-d077-412b-b136-12be7560c4a1`
- Public URL: `https://internal-toolkit-api-production.up.railway.app`

Health verification:
- `GET /health` returned `200` JSON payload with `ok: true`.

## 6) Frontend on Vercel (Passed)
- Added/verified `NEXT_PUBLIC_API_URL` for `preview` and `production` (name-only verification).
- `vercel build --prod` passed.
- Production deploy succeeded:
  - `https://internal-tool-kit-mepmr5zxd-kostasuser01gr.vercel.app`
  - alias: `https://internal-tool-kit-ops.vercel.app`
- `vercel logs --environment production --since 60m --level error` showed no repeated errors.

Runtime contract checks on production alias:
- `/login` => `200` with `content-type: text/html; charset=utf-8`
- `/api/health` => `200` with `content-type: application/json`

## 7) Convex Verification (Passed)
- `npx convex codegen` passed.
- `npx convex deploy -y` passed.
- Prod deployment target used by CLI: `beloved-monitor-46`.

## 8) GitHub Actions Verification
- Latest push-run IDs on `main` (head `98c0391f737f2d0103b3eb4e79e2f33c6026244a`):
  - CI: `22730190655` ✅
  - CodeQL: `22730190595` ✅
  - Lighthouse CI: `22730190645` ✅
- Deploy Worker verification run on `main`:
  - Deploy Worker: `22730125426` ✅ (`workflow_dispatch`)
- Additional verification runs (manual, same head):
  - CI: `22730125473` ✅
  - CodeQL: `22730125413` ✅
  - Lighthouse CI: `22730125436` ✅

## 9) Re-Verification Commands
- `pnpm -w lint && pnpm -w typecheck && pnpm -w test && pnpm --filter @internal-toolkit/web build`
- `cd apps/web && pnpm exec playwright test tests/smoke.spec.ts --project Desktop --reporter=line`
- `cd apps/web && pnpm exec playwright test tests/modules.spec.ts --project Desktop --reporter=line`
- `cd apps/web && pnpm test:system-scan:v2`
- `curl -si https://internal-tool-kit-ops.vercel.app/login | head -n 20`
- `curl -si https://internal-tool-kit-ops.vercel.app/api/health | head -n 20`
- `curl -si https://internal-toolkit-api-production.up.railway.app/health | head -n 20`
