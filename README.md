# InternalToolKit

Production-ready monorepo template for an internal operations dashboard:
- `apps/web`: Next.js App Router frontend (Vercel target)
- `apps/api`: Cloudflare Worker backend (Wrangler/GitHub Actions target)
- `packages/shared`: shared TypeScript + Zod schemas/contracts

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

Common vars:
- `NEXT_PUBLIC_API_URL`
- `DATABASE_URL`
- `ASSISTANT_PROVIDER` (`mock` default)
- `OPENAI_API_KEY` (required only when provider is `openai`)

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
- Same-origin checks for unsafe web route handlers
- Login abuse control (in-memory rate limiting)
- Request-id propagation (`X-Request-Id`) and structured API request logs
- Append-only audit log pattern via `AuditLog` model and `appendAuditLog()`

## Testing

- Unit tests: `pnpm test:unit`
- E2E smoke tests: `pnpm test:e2e`
- Full test gate: `pnpm test`

Playwright smoke suite covers auth gate, responsive shell, nav flows, command palette, data workflow, and admin access behavior.

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
