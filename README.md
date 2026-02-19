# InternalToolKit

Production-ready monorepo template for an internal operations dashboard:
- `apps/web`: Next.js App Router frontend (Vercel target)
- `apps/api`: Cloudflare Worker backend (Wrangler/GitHub Actions target)
- `packages/shared`: shared TypeScript + Zod schemas/contracts

Core implemented modules:
- Auth + sessions (`loginName + 4-digit PIN`, plus email/password compatibility)
- RBAC-safe admin/users management
- Team chat
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
- `SESSION_SECRET` (required in hosted env, >=16 chars)
- `DATABASE_URL` (required in hosted env; use a writable production database URL)
- `NEXT_PUBLIC_API_URL`
- `ASSISTANT_PROVIDER` (`mock` default)
- `OPENAI_API_KEY` (required only when `ASSISTANT_PROVIDER=openai`)
- `NEXT_PUBLIC_FEATURE_VOICE_INPUT` (`0` default)

API worker (`apps/api`), see `apps/api/.dev.vars.example`:
- `APP_VERSION`
- `ENVIRONMENT` (`dev`/`prod`)
- `ALLOWED_ORIGINS` (strict comma-separated allowlist; `*` rejected)
- `OPENAI_API_KEY` (optional)
- `ALLOW_LEGACY_MUTATIONS` (`0` default, keep off)

Runtime fallback:
- Local/non-hosted runtime falls back to `file:./dev.db` when `DATABASE_URL` is not set.
- Hosted runtime fails fast when `SESSION_SECRET` or `DATABASE_URL` is missing/blank to prevent opaque runtime 500s.
- Hosted runtime also rejects `DATABASE_URL=file:...`; use a persistent production database URL.

## Runtime 500 Remediation (2026-02-19)
- Symptom: production `POST /api/session/login` returned 500.
- Root cause: hosted env had missing/invalid auth/db runtime variables (missing `SESSION_SECRET`, placeholder/invalid `DATABASE_URL`).
- Fix: added hosted fail-fast env validation, switched DB bootstrap to validated env source, and blocked file-based sqlite URLs in hosted production.

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
   - `SESSION_SECRET=<strong-random-secret>`
   - `NEXT_PUBLIC_API_URL=https://<worker-name>.<subdomain>.workers.dev`
   - `DATABASE_URL=<persistent-db-url>` (recommended)
5. Connect Vercel to `main` branch for auto deploys.

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

Run date: `2026-02-19`

Command:
```bash
pnpm install --frozen-lockfile
```
Output:
```text
Scope: all 4 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date

╭ Warning ─────────────────────────────────────────────────────────────────────╮
│                                                                              │
│   Ignored build scripts: @prisma/engines, better-sqlite3, esbuild, prisma,   │
│   sharp, unrs-resolver, workerd.                                             │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed     │
│   to run scripts.                                                            │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯

Done in 432ms using pnpm v10.17.1

   ╭──────────────────────────────────────────╮
   │                                          │
   │   Update available! 10.17.1 → 10.30.0.   │
   │   Changelog: https://pnpm.io/v/10.30.0   │
   │     To update, run: pnpm add -g pnpm     │
   │                                          │
   ╰──────────────────────────────────────────╯
```

Command:
```bash
pnpm lint
```
Output:
```text
> internal-toolkit@1.0.0 lint /Users/user/projects/InternalToolKit
> pnpm --filter @internal-toolkit/shared lint && pnpm --filter @internal-toolkit/api lint && pnpm --filter @internal-toolkit/web lint


> @internal-toolkit/shared@1.0.0 lint /Users/user/projects/InternalToolKit/packages/shared
> eslint src --max-warnings=0


> @internal-toolkit/api@1.0.0 lint /Users/user/projects/InternalToolKit/apps/api
> eslint src --max-warnings=0


> @internal-toolkit/web@1.0.0 lint /Users/user/projects/InternalToolKit/apps/web
> eslint . --max-warnings=0
```

Command:
```bash
pnpm typecheck
```
Output:
```text
> internal-toolkit@1.0.0 typecheck /Users/user/projects/InternalToolKit
> pnpm --filter @internal-toolkit/shared typecheck && pnpm --filter @internal-toolkit/api typecheck && pnpm --filter @internal-toolkit/web typecheck


> @internal-toolkit/shared@1.0.0 typecheck /Users/user/projects/InternalToolKit/packages/shared
> tsc --noEmit


> @internal-toolkit/api@1.0.0 typecheck /Users/user/projects/InternalToolKit/apps/api
> tsc --noEmit


> @internal-toolkit/web@1.0.0 typecheck /Users/user/projects/InternalToolKit/apps/web
> prisma generate && tsc --noEmit

Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.

✔ Generated Prisma Client (v7.4.0) to ./../../node_modules/.pnpm/@prisma+client@7.4.0_prisma@7.4.0_@types+react@19.2.14_better-sqlite3@12.6.2_react-dom@_d37e6b0a2bd4a8b1868fc2d62e7c9b5d/node_modules/@prisma/client in 137ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
```

Command:
```bash
pnpm test:unit
```
Output:
```text
> internal-toolkit@1.0.0 test:unit /Users/user/projects/InternalToolKit
> pnpm --filter @internal-toolkit/web test:unit


> @internal-toolkit/web@1.0.0 test:unit /Users/user/projects/InternalToolKit/apps/web
> vitest run


 RUN  v3.2.4 /Users/user/projects/InternalToolKit/apps/web

 ✓ tests/unit/rate-limit.test.ts (2 tests) 1ms
 ✓ tests/unit/security.test.ts (3 tests) 2ms
 ✓ tests/unit/shared-schemas.test.ts (3 tests) 4ms
 ✓ tests/unit/rbac-matrix.test.ts (4 tests) 1ms

 Test Files  4 passed (4)
      Tests  12 passed (12)
   Start at  15:07:31
   Duration  647ms (transform 107ms, setup 0ms, collect 405ms, tests 8ms, environment 0ms, prepare 213ms)
```

Command:
```bash
NODE_OPTIONS=--no-warnings pnpm test:e2e
```
Output:
```text
> internal-toolkit@1.0.0 test:e2e /Users/user/projects/InternalToolKit
> pnpm --filter @internal-toolkit/web test:e2e


> @internal-toolkit/web@1.0.0 pretest:e2e /Users/user/projects/InternalToolKit/apps/web
> playwright install chromium


> @internal-toolkit/web@1.0.0 test:e2e /Users/user/projects/InternalToolKit/apps/web
> pnpm db:reset && playwright test


> @internal-toolkit/web@1.0.0 db:reset /Users/user/projects/InternalToolKit/apps/web
> node scripts/reset-db.mjs


> @internal-toolkit/web@1.0.0 db:migrate:deploy /Users/user/projects/InternalToolKit/apps/web
> node scripts/migrate-deploy.mjs

Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

Error: Schema engine error:

prisma migrate deploy failed, applying checked-in SQL migrations with sqlite3 fallback for fresh local DB.
Loaded Prisma config from prisma.config.ts.

Running seed command `tsx prisma/seed.ts` ...
Seed complete {
  admin: 'admin@internal.local',
  viewer: 'viewer@internal.local',
  employee: 'employee@internal.local',
  washer: 'washer@internal.local',
  workspaceId: 'seed-workspace'
}

🌱  The seed command has been executed.

Running 33 tests using 5 workers

  18 skipped
  15 passed (32.1s)
```

Command:
```bash
pnpm build
```
Output:
```text
> internal-toolkit@1.0.0 build /Users/user/projects/InternalToolKit
> pnpm --filter @internal-toolkit/shared build && pnpm --filter @internal-toolkit/api build && pnpm --filter @internal-toolkit/web build


> @internal-toolkit/shared@1.0.0 build /Users/user/projects/InternalToolKit/packages/shared
> tsc -p tsconfig.json


> @internal-toolkit/api@1.0.0 build /Users/user/projects/InternalToolKit/apps/api
> wrangler deploy --dry-run --outdir dist --env production


 ⛅️ wrangler 4.66.0
───────────────────
Total Upload: 536.79 KiB / gzip: 79.86 KiB
Your Worker has access to the following bindings:
Binding                                                                 Resource
env.APP_VERSION ("1.0.0")                                               Environment Variable
env.ENVIRONMENT ("prod")                                                Environment Variable
env.ALLOWED_ORIGINS ("https://app.internaltoolkit.example")             Environment Variable
env.ALLOW_LEGACY_MUTATIONS ("0")                                        Environment Variable

--dry-run: exiting now.

> @internal-toolkit/web@1.0.0 build /Users/user/projects/InternalToolKit/apps/web
> prisma generate && next build

Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.

✔ Generated Prisma Client (v7.4.0) to ./../../node_modules/.pnpm/@prisma+client@7.4.0_prisma@7.4.0_@types+react@19.2.14_better-sqlite3@12.6.2_react-dom@_d37e6b0a2bd4a8b1868fc2d62e7c9b5d/node_modules/@prisma/client in 134ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)


▲ Next.js 16.1.6 (Turbopack)
- Environments: .env.local, .env

  Creating an optimized production build ...
✓ Compiled successfully in 2.4s
  Running TypeScript ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/40) ...
  Generating static pages using 9 workers (10/40)
  Generating static pages using 9 workers (20/40)
  Generating static pages using 9 workers (30/40)
✓ Generating static pages using 9 workers (40/40) in 142.6ms
  Finalizing page optimization ...
```

## Documentation Index

- `docs/adr/backend-strategy.md`
- `docs/adr/migrations-strategy.md`
- `docs/ADR-0001-storage.md`
- `docs/AUDIT.md`
- `docs/DEPLOY.md`
- `docs/SECURITY.md`
- `docs/TROUBLESHOOTING.md`
- `CHANGELOG.md`
