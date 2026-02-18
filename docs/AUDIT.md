# AUDIT Report

## Baseline Report (Phase A)

### Environment and Tooling Snapshot
- `node -v` -> `v25.6.1`
- `pnpm -v` -> `10.17.1`
- Workspace manager -> `pnpm-workspace.yaml`
- Monorepo packages -> `apps/web`, `apps/api`, `packages/shared`

### Baseline Command Suite
- `pnpm -w install` -> PASS
- `pnpm -w lint` -> PASS
- `pnpm -w typecheck` -> PASS
- `pnpm -w test` -> PASS (`9 passed, 6 skipped` Playwright smoke suite)
- `pnpm -w build` -> PASS

### Baseline Findings
- `P0` Missing hardening in API worker responses: no request-id propagation and no explicit security headers on every response.
- `P0` CORS parser still allowed wildcard (`*`), conflicting with strict allowlist deployment policy.
- `P0` No login rate-limiting guard on web auth endpoints.
- `P1` No unit test layer for shared schema/contracts and auth/security helper behavior.
- `P1` Next.js deprecation warning from `middleware` file convention (`middleware` -> `proxy`).
- `P2` Missing operational docs required for production readiness (`DEPLOY`, `SECURITY`, `TROUBLESHOOTING`, ADR).

## Fix Log (Phase B)

1. Web security middleware migration and hardening
- Replaced `apps/web/middleware.ts` with `apps/web/proxy.ts`.
- Added per-request CSP nonce strategy, request-id propagation (`X-Request-Id`), and web security headers.
- Preserved auth gate routing behavior (redirect unauthenticated app routes to `/login`).

2. API worker hardening
- Updated `apps/api/src/index.ts`:
  - strict CORS allowlist (`ALLOWED_ORIGINS` wildcard now rejected)
  - proper OPTIONS handling with `Vary: Origin`
  - security headers on responses (`nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, conditional HSTS)
  - request-id generation/propagation (`X-Request-Id`)
  - structured request logging (`event: api.request`, method, path, status, duration)

3. CSRF and abuse controls
- Strengthened same-origin checks in `apps/web/lib/security.ts` using `Origin`/`Referer` + host comparison for unsafe methods.
- Added auth endpoint rate limiter in `apps/web/lib/rate-limit.ts`.
- Enforced rate limiting in:
  - `apps/web/app/api/session/login/route.ts`
  - `apps/web/app/api/session/login-form/route.ts`

4. Testing upgrades
- Added unit test runner (`vitest`) for web package.
- Added tests:
  - `apps/web/tests/unit/shared-schemas.test.ts`
  - `apps/web/tests/unit/security.test.ts`
  - `apps/web/tests/unit/rate-limit.test.ts`
- Scoped Playwright to `*.spec.ts` via `apps/web/playwright.config.ts` to avoid unit-test pickup.

5. CI quality gate improvement
- Updated `.github/workflows/ci.yml` to run `Unit tests` before Playwright smoke tests.

6. PWA baseline
- Added minimal custom service worker:
  - `apps/web/public/sw.js`
  - registration in `apps/web/components/providers.tsx`

7. Documentation and release artifacts
- Added/updated required docs and release notes.

## Verification Evidence (Phase C)

### Clean Room Verification
1. Clean artifacts removed (`node_modules`, `.next`, `.wrangler`) -> PASS
2. `pnpm install --frozen-lockfile` -> PASS
3. `pnpm lint` -> PASS
4. `pnpm typecheck` -> PASS
5. `pnpm test` -> PASS (unit + e2e)
6. `pnpm build` -> PASS

Note:
- `pnpm -w install` only installs the workspace root importer in this setup.
- Full workspace hydration for a fresh clone is `pnpm install` from repository root.

### Runtime Checks
- API dev (`pnpm -C apps/api dev`) -> `/health` returns 200 + security headers + `X-Request-Id`.
- Strict CORS verification -> unknown Origin returns 403 (`{"ok":false,"error":"Origin not allowed."}`).
- Web production-like runtime (`next start`) -> `/login` returns 200 with CSP + nonce + security headers.
- Login form route same-origin POST behavior -> 303 redirect on invalid credentials.

### GitHub Checks
- CI workflow file includes install -> lint -> typecheck -> unit tests -> e2e -> build.
- Latest CI run for release commit `62c00a2` -> PASS:
  - `CI` run `22141293627`: `completed success`
  - `Deploy Worker` run `22141293610`: `completed success`
- Latest CI run on current `main` head also PASS:
  - `CI` run `22141418051`: `completed success`

## Final Acceptance Checklist (DONE ✅)
- [x] Fresh clone install path works
- [x] Lint passes
- [x] Typecheck passes
- [x] Tests pass (unit + smoke e2e)
- [x] Build passes
- [x] Local runtime works for web and api
- [x] Security baseline implemented (CORS, headers, CSP nonce, cookies, origin checks)
- [x] Audit logging present (append-only pattern with persisted `AuditLog` model)
- [x] CI pipeline enforces quality gates
- [x] Deployment docs and runbooks completed

DONE ✅
