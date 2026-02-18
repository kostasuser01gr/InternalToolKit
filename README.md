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

1. Install dependencies:
```bash
pnpm install
```

2. Create local env files (optional but recommended):
```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

3. Start both apps:
```bash
pnpm dev
```

Default local endpoints:
- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

Local seeded users after `pnpm test:e2e` or `pnpm -C apps/web db:reset`:
- `admin` / PIN `1234`
- `viewer` / PIN `2222`
- `employee` / PIN `3456`
- `washer` / PIN `7777`

## Scripts

From repository root:
- `pnpm dev` -> run web + api in parallel
- `pnpm lint` -> lint shared + api + web
- `pnpm typecheck` -> typecheck shared + api + web
- `pnpm test:unit` -> unit tests (Vitest, web package)
- `pnpm test:e2e` -> Playwright smoke suite
- `pnpm test` -> unit + e2e
- `pnpm build` -> shared build + api dry-run deploy + web production build

## Environment Variables

### Web (`apps/web`)
See `apps/web/.env.example`.

Required in hosted production:
- `SESSION_SECRET` (or `NEXTAUTH_SECRET`) with at least 16 chars
- `DATABASE_URL` (recommended for persistent data)

Common vars:
- `NEXT_PUBLIC_API_URL`
- `DATABASE_URL`
- `ASSISTANT_PROVIDER` (`mock` default)
- `OPENAI_API_KEY` (required only when provider is `openai`)
- `NEXT_PUBLIC_FEATURE_VOICE_INPUT` (`0` default, enables Web Speech API helpers)

Runtime fallback:
- If `DATABASE_URL` is not set in production, web runtime automatically uses a writable sqlite copy at `/tmp/internal-toolkit-runtime.db`.
- This fallback is for demo continuity only and is not persistent across cold starts/redeploys.

### API Worker (`apps/api`)
See `apps/api/.dev.vars.example`.

- `APP_VERSION`
- `ENVIRONMENT` (`dev`/`prod`)
- `ALLOWED_ORIGINS` (strict comma-separated allowlist, wildcard `*` rejected)
- `OPENAI_API_KEY` (optional)

## Security Defaults

- Strict CORS allowlist in worker with correct `OPTIONS` handling and `Vary: Origin`
- API security headers (`nosniff`, frame deny, referrer policy, permissions policy, HTTPS HSTS)
- CSP nonce strategy in web proxy (`apps/web/proxy.ts`)
- Hardened session cookies (HttpOnly + SameSite + Secure in production)
- Login/signup loop prevention with stale-cookie handling and server-side auth-page guard
- Same-origin checks for unsafe web route handlers
- Login abuse control (in-memory rate limiting)
- Request-id propagation (`X-Request-Id`) and structured API request logs
- Append-only audit log pattern via `AuditLog` model and `appendAuditLog()`

## Testing

- Unit tests: `pnpm test:unit`
- E2E smoke tests: `pnpm test:e2e`
- Full test gate: `pnpm test`

Playwright smoke suite covers auth gate, responsive shell, nav flows, command palette, data workflow, and admin access behavior.
Desktop smoke coverage also includes signup + login, chat flow, shift planner flow, and fleet create/update flow.

## Delivery Modes (Documented Trade-offs)

- `Best` (default): full module set enabled (chat, shifts, fleet, washers, calendar), strict security controls, smoke/unit gates, PWA + optional voice input via flag.
- `Cheap`: keep assistant provider in `mock`, voice input flag off, sqlite/local persistence, reduced cloud integration.
- `Fast MVP`: prioritize auth + shell + core CRUD flows; advanced integrations remain behind feature flags until enabled.

## CI

Workflow: `.github/workflows/ci.yml`
- install
- lint
- typecheck
- unit tests
- Playwright e2e smoke
- build

## Deployment

### Web (Vercel)
1. Import repo in Vercel
2. Set Root Directory to `apps/web`
3. Add env vars:
   - `NEXT_PUBLIC_API_URL=https://<your-worker>.<subdomain>.workers.dev`
   - `SESSION_SECRET=<strong-random-secret-at-least-16-chars>`
4. Deploy

### API (Cloudflare Worker)
```bash
pnpm --filter @internal-toolkit/api deploy
```

GitHub deploy workflow requires repository secret:
- `CLOUDFLARE_API_TOKEN`
Optional:
- `CLOUDFLARE_ACCOUNT_ID`

## Documentation Index

- `docs/AUDIT.md` -> baseline + fix log + final verification checklist
- `docs/DEPLOY.md` -> Vercel + Cloudflare deployment runbook
- `docs/SECURITY.md` -> headers/CSP/cookies/CORS/rate-limit/audit policy
- `docs/TROUBLESHOOTING.md` -> common failures and fixes
- `docs/ADR-0001-storage.md` -> storage decision record
- `CHANGELOG.md` -> release notes
