# Deployment Guide

## Overview
- Frontend: Vercel (`apps/web`)
- API: Cloudflare Workers (`apps/api`)

## Required Secrets and Environment Variables

### GitHub Actions (Repository Secrets)
- `CLOUDFLARE_API_TOKEN` (required for worker deploy workflow)
- `CLOUDFLARE_ACCOUNT_ID` (optional in this workflow; include if your account requires explicit ID)

### Vercel (Project Env Vars)
Set these in Vercel project settings for `apps/web`:
- `NEXT_PUBLIC_API_URL=https://<your-worker>.<subdomain>.workers.dev`
- `SESSION_SECRET=<strong-random-secret-at-least-16-chars>`
- `DATABASE_URL=<your-prod-db-url>` (recommended for persistent writes)
- Optional:
  - `ASSISTANT_PROVIDER` (`mock` default)
  - `OPENAI_API_KEY` (only when `ASSISTANT_PROVIDER=openai`)
  - `NEXT_PUBLIC_FEATURE_VOICE_INPUT` (`0` default; set `1` to enable Web Speech UI helpers)

If `DATABASE_URL` is omitted, web runtime falls back to writable `/tmp/internal-toolkit-runtime.db` for demo continuity. This fallback is ephemeral and not durable across cold starts/redeploys.

### Cloudflare Worker Vars
Set in Wrangler/Cloudflare:
- `APP_VERSION`
- `ENVIRONMENT` (`dev` or `prod`)
- `ALLOWED_ORIGINS` (comma-separated strict allowlist, no `*`)
- `OPENAI_API_KEY` (optional)

## Deploy Web (Vercel)
1. Import repository into Vercel.
2. Set project Root Directory to `apps/web`.
3. Add required environment variables.
4. Trigger deploy from `main` push or manual redeploy.

## Deploy Worker (Cloudflare)
From repository root:
```bash
pnpm --filter @internal-toolkit/api deploy
```

## GitHub Workflows
- CI: `.github/workflows/ci.yml`
  - install -> lint -> typecheck -> unit tests -> e2e smoke -> build
- Worker Deploy: `.github/workflows/deploy-worker.yml`
  - triggers on `main` changes for API/shared/lockfiles + manual dispatch
  - skips safely when `CLOUDFLARE_API_TOKEN` is missing

## Post-Deploy Checks
- Web: open `/login`, verify `loginName + PIN` auth flow and account signup.
- Web: verify core pages load (`/shifts`, `/fleet`, `/washers`, `/calendar`).
- API: `GET /health` returns `{ ok: true, version, timestamp }`.
- CORS: verify only allowed origins can access worker endpoints.
