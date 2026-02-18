# InternalToolKit

Monorepo for an internal dashboard frontend (Next.js on Vercel) and API backend (Cloudflare Workers via Wrangler/GitHub Actions).

## Monorepo Structure

```text
/
  apps/
    web/   (Next.js App Router + TS + Tailwind + shadcn/ui + Radix + lucide-react + framer-motion)
    api/   (Cloudflare Worker + TS + Wrangler)
  packages/
    shared/ (types + zod schemas)
  .github/workflows/
    ci.yml
    deploy-worker.yml
  README.md
  pnpm-workspace.yaml
  package.json
```

## Root Scripts

- `pnpm dev` -> runs `apps/api` + `apps/web` in parallel
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:e2e`

## API Surface (`apps/api`)

- `GET /health` -> `{ ok: true, version, timestamp }`
- `POST /v1/audit` -> validates payload and returns `{ ok: true, id }`
- `POST /v1/assistant/draft-automation` -> accepts `{ prompt }`, returns `{ ok: true, triggerJson, actionsJson }` (mock provider by default)

Worker env vars:

- `ENVIRONMENT` (`dev|prod`)
- `ALLOWED_ORIGINS` (comma-separated; for Vercel/web origins)
- `APP_VERSION` (optional override)
- `OPENAI_API_KEY` (optional, reserved for adapter extension)

Local dev vars file:

- `apps/api/.dev.vars` (ignored by git)
- template: `apps/api/.dev.vars.example`

## Web/API Wiring (`apps/web`)

- Browser-safe API base URL uses `NEXT_PUBLIC_API_URL`
- API client lives at `apps/web/lib/api/client.ts`
- Dashboard includes an `API Status` widget that calls `/health` and renders `ok` / `not ok`

## Local Development

1. Install dependencies:

```bash
pnpm i
```

2. Start both apps:

```bash
pnpm dev
```

Optional local web env file (recommended):

```bash
cp apps/web/.env.example apps/web/.env.local
```

Notes:

- Local development has a safe fallback session secret for quick start.
- Hosted production (CI/Vercel/GitHub Actions) requires `SESSION_SECRET` (or `NEXTAUTH_SECRET`) to be set explicitly.

Default local URLs:

- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

## Cloudflare SOP (Backend)

From repo root:

```bash
npx wrangler login
npx wrangler dev
npx wrangler deploy
npx wrangler secret put <KEY>
```

Or run package scripts:

```bash
pnpm --filter @internal-toolkit/api dev
pnpm --filter @internal-toolkit/api deploy
```

## GitHub Actions SOP

### CI (`.github/workflows/ci.yml`)

- Triggers on `push` and `pull_request`
- Runs:
  - `pnpm install`
  - `pnpm lint`
  - `pnpm typecheck`
  - Playwright smoke tests for web (`pnpm test:e2e`)
  - `pnpm build`
- Uses pnpm cache via `actions/setup-node`

### Worker Deploy (`.github/workflows/deploy-worker.yml`)

- Triggers on:
  - `push` to `main` (with API/shared path filters)
  - `workflow_dispatch` (manual deploy)
- Uses `cloudflare/wrangler-action@v3`
- Deploy command runs in `apps/api` (`workingDirectory: apps/api`)

Required repo secrets:

- `CLOUDFLARE_API_TOKEN` (required)
- `CLOUDFLARE_ACCOUNT_ID` (optional; only if your setup/action path needs explicit account)

## Vercel SOP (Frontend)

1. Import this GitHub repository in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Add env var:
   - `NEXT_PUBLIC_API_URL=https://<your-worker>.<subdomain>.workers.dev`
4. Push to GitHub to trigger automatic deployments.

Important:

- Vercel env var updates are applied only to new deployments.

## Git Remote and Push Sanity Checks

```bash
git remote -v
git status
```

Expected:

- `origin` should be `https://github.com/kostasuser01gr/InternalToolKit.git`
- working tree should be clean before/after pushing

## Troubleshooting

- CORS errors from web to Worker:
  - confirm `ALLOWED_ORIGINS` includes your Vercel domain and local origins
  - update secret/vars and redeploy Worker
- Wrong Vercel root directory:
  - ensure project Root Directory is exactly `apps/web`
- Missing frontend env vars:
  - set `NEXT_PUBLIC_API_URL` in Vercel and redeploy
- Missing session secret in hosted production:
  - set `SESSION_SECRET` (or `NEXTAUTH_SECRET`) in your deployment environment
  - redeploy after saving env vars
- Worker deploy failing in Actions:
  - confirm `CLOUDFLARE_API_TOKEN` exists in repo secrets
  - if required by account config, add `CLOUDFLARE_ACCOUNT_ID`
  - review workflow logs in GitHub Actions for Wrangler errors
