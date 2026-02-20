# InternalToolKit

Production-ready monorepo template for an internal operations dashboard:
- `apps/web`: Next.js App Router frontend (Vercel target)
- `apps/api`: Cloudflare Worker backend (Wrangler/GitHub Actions target)
- `packages/shared`: shared TypeScript + Zod schemas/contracts

Core implemented modules:
- Auth + sessions (`loginName + 4-digit PIN`, plus email/password compatibility)
- RBAC-safe admin/users management
- Unified team chat workspace (threads + slash commands + artifacts + pinned context)
- Shift planner (weekly board + drag/drop move + request flow + CSV import/export)
- Fleet management (vehicles + status/km/fuel + event logging)
- Washer operations (task queue + optional voice notes)
- Shared calendar timeline (shifts/requests/fleet/washer events)
- Quantum theme switching (violet/cyan/amber) + dark/light mode toggle

## Monorepo Layout

```text
/
  apps/
    web/
    api/
  packages/
    shared/
  docs/
  .github/workflows/
```

## Requirements

- Node.js 22+ (CI uses Node 22)
- pnpm 10.x

## Quickstart (Under 15 Minutes)

1. Install dependencies.
```bash
pnpm install
```
2. Create local env files.
```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
```
3. Apply DB migrations.
```bash
pnpm --filter @internal-toolkit/web db:migrate:deploy
```
4. Start web + api.
```bash
pnpm dev
```

Default local endpoints:
- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

Dev seed users after `pnpm test:e2e` or `pnpm --filter @internal-toolkit/web db:reset`:
- `admin` / PIN `1234`
- `viewer` / PIN `2222`
- `employee` / PIN `3456`
- `washer` / PIN `7777`

These seeded credentials are for local smoke/dev only and are not a production onboarding flow.

## Run / Test / Build

From repo root:
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm test`
- `pnpm build`

Database scripts (`apps/web`):
- `pnpm --filter @internal-toolkit/web db:migrate:dev`
- `pnpm --filter @internal-toolkit/web db:migrate:deploy`
- `pnpm --filter @internal-toolkit/web db:migrate:status`
- `pnpm --filter @internal-toolkit/web db:reset`

## Environment Variables

Web (`apps/web`), see `apps/web/.env.example`:
- `SESSION_SECRET` (required in hosted env, >=32 chars)
- `DATABASE_URL` (required in hosted env; Supabase pooler URI recommended)
- `DIRECT_URL` (required for migration workflows; Supabase direct URI; runtime fallback target)
- `NEXT_PUBLIC_API_URL`
- `FREE_ONLY_MODE` (`1` required)
- `AI_PROVIDER_MODE` (`cloud_free` or `mock`)
- `AI_ALLOW_PAID` (`0` required)
- `NEXT_PUBLIC_FEATURE_VOICE_INPUT` (`0` default)
- `NEXT_PUBLIC_FEATURE_UNIFIED_CHAT` (`1` default)
- `NEXT_PUBLIC_FEATURE_CUSTOM_SHORTCUTS` (`1` default)
- `NEXT_PUBLIC_FEATURE_CLOUD_AI_GATEWAY` (`1` default)

API worker (`apps/api`), see `apps/api/.dev.vars.example`:
- `APP_VERSION`
- `ENVIRONMENT` (`dev`/`prod`)
- `ALLOWED_ORIGINS` (strict comma-separated allowlist; `*` rejected)
- `FREE_ONLY_MODE` (`1` required)
- `AI_PROVIDER_MODE` (`cloud_free` or `mock`)
- `AI_ALLOW_PAID` (`0` required)
- `ALLOW_LEGACY_MUTATIONS` (`0` default, keep off)

Runtime validation:
- Hosted runtime fails fast when `SESSION_SECRET` or `DATABASE_URL` is missing/blank.
- Hosted runtime rejects `DATABASE_URL=file:...`; production must use persistent Postgres.
- Hosted runtime requires `DATABASE_URL` to start with `postgresql://` or `postgres://`.
- Hosted runtime requires structurally valid Postgres URIs; use raw URI values and URL-encode special password characters.
- Free-only mode is enforced: `FREE_ONLY_MODE=1`, `AI_ALLOW_PAID=0`, and paid provider keys are rejected.
- Local development defaults to `postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public`.
- Supabase format examples:
  - `DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require`
  - `DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require`
- Vercel env inputs must be raw URI values only (no `DATABASE_URL=` prefix and no wrapping quotes).
- Runtime prefers `DATABASE_URL` and automatically retries with `DIRECT_URL` once on DB connectivity errors.

## Runtime 500 Remediation (2026-02-19)
- Symptom: production `POST /api/session/login` returned 500.
- Root cause: hosted env had invalid runtime DB config (sqlite/file URL), and runtime env validation had been too strict for non-runtime migration variables.
- Fix: moved runtime to Postgres path, scoped hosted fail-fast validation to runtime-required vars, and blocked file-based sqlite URLs in hosted production.

## Auth and Security Baseline

- Invite onboarding uses one-time token flow with expiry and audit events.
- Password reset uses one-time token flow with expiry and session revocation on completion.
- Password/PIN values are never stored plaintext (`bcrypt` hashes only).
- Session lifecycle is DB-backed (`AuthSession`): active sessions list, revoke current, revoke one, revoke all.
- Admin-destructive actions require step-up PIN verification with short-lived elevated session.
- Login abuse controls are DB-backed and distributed by IP + account + device dimensions with lockouts and security events.
- Structured request logging + request IDs are propagated and surfaced in error/status UI.

## Canonical Backend Strategy

Canonical backend is **Web-only** (`apps/web` route handlers + server actions) for auth/RBAC/domain mutations.

Worker (`apps/api`) remains non-canonical for health/integration endpoints:
- Legacy worker mutation endpoints are disabled by default via `ALLOW_LEGACY_MUTATIONS=0`.
- Compatibility mode (if re-enabled temporarily) has a hard deprecation deadline: `2026-06-30`.

Details: `docs/adr/backend-strategy.md`.

## Data Scaling Contract

Data list/query contract is implemented with:
- `page`
- `pageSize`
- `sort`
- `sortField`
- `q`
- `from`
- `to`

Large record sets are paged at query layer (no full-table in-memory scans), with deterministic sort including `id` tie-breaker and supporting indexes (`Record` table indexes on pagination/search paths).

## Migration SOP and Rollback

Migration strategy ADR: `docs/adr/migrations-strategy.md`.

SOP:
1. Change schema in `apps/web/prisma/schema.prisma`.
2. Create migration locally: `pnpm --filter @internal-toolkit/web db:migrate:dev`.
3. Commit migration files under `apps/web/prisma/migrations`.
4. Deploy with: `pnpm --filter @internal-toolkit/web db:migrate:deploy`.
5. Verify with: `pnpm --filter @internal-toolkit/web db:migrate:status`.

Local-only shortcut (never in CI/prod):
- `pnpm --filter @internal-toolkit/web db:push:dev`

Rollback/restore note:
1. Take DB backup/snapshot before deploy.
2. If rollback is required, redeploy previous app revision.
3. Restore DB snapshot to pre-migration state.
4. Re-run migration status and smoke checks.

## Deployment

### Web (Vercel via GitHub)
1. Import this repo in Vercel.
2. Set root directory to `apps/web`.
3. Build command: `pnpm build` (at repo root is also supported by monorepo setup).
4. Set env vars at minimum:
   - `SESSION_SECRET=<strong-random-secret-at-least-32-chars>`
   - `NEXT_PUBLIC_API_URL=https://<worker-name>.<subdomain>.workers.dev`
   - `DATABASE_URL=<supabase-pooled-uri>`
   - `DIRECT_URL=<supabase-direct-uri>`
5. Connect Vercel to `main` branch for auto deploys.
6. Redeploy after any env var update.

### API (Cloudflare Workers via GitHub Actions)
1. Configure `apps/api/wrangler.toml` environments (`dev`, `staging`, `production`) as needed.
2. Set GitHub repository secrets:
   - `CLOUDFLARE_API_TOKEN` (required)
   - `CLOUDFLARE_ACCOUNT_ID` (optional)
3. Worker deploy workflow (`.github/workflows/deploy-worker.yml`) deploys on `main` with:
   - `wrangler deploy --env production`
4. Local manual deploy:
```bash
pnpm --filter @internal-toolkit/api deploy
```

### Cloud Verification (Post-Deploy)
```bash
curl -s https://<your-domain>/api/health
curl -s https://<your-domain>/v1/ai/models
curl -s https://<your-domain>/v1/ai/usage
curl -s https://<your-domain>/manifest.json
curl -s https://<your-domain>/api/version
```

## OpenAI MCP Registration (Cloudflare Tunnel, Free)

Recommended free method for public HTTPS exposure: Cloudflare Tunnel.

- Use `ops/cloudflare/setup.md` for full setup (quick mode + named tunnel mode).
- Example tunnel config template: `ops/cloudflare/config.example.yml`.
- OpenAI MCP domain verification does **not** work with `localhost` URLs.
- Verification requires a public HTTPS URL and the verification file must return **plain text only** (no HTML wrapper).

Verification commands:
```bash
curl https://app.example.com/.well-known/mcp-verification.txt
curl https://app.example.com/health
```

OpenAI form copy/paste pack:
- `ops/openai-form-pack.md`

## CI Gates

CI workflow: `.github/workflows/ci.yml`
- install
- migrate deploy
- lint
- typecheck
- unit tests
- e2e smoke
- build

## Proof Pack

Run these from repo root:

```bash
pnpm -w install
pnpm -w lint
pnpm -w typecheck
pnpm -w test
pnpm -C apps/web build
```

Expected outcomes:
- install succeeds with no manual edits beyond env vars.
- lint/typecheck pass.
- unit + e2e tests pass.
- Next.js build completes successfully.

## Documentation Index

- `docs/adr/backend-strategy.md`
- `docs/adr/migrations-strategy.md`
- `docs/ADR-0001-storage.md`
- `docs/AUDIT.md`
- `docs/DEPLOY.md`
- `docs/SECURITY.md`
- `docs/TROUBLESHOOTING.md`
- `CHANGELOG.md`
