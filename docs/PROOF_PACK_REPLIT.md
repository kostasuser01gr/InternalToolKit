# Proof Pack: Replit + CI + Production

## Commit and Repository State

- Branch: `main`
- Commit: `b56b45d`
- Scope: Replit deploy hardening + CI failure snapshot + deployment runbook additions

## Final GitHub Actions Run IDs (latest commit)

- `CI` (push): `22990437805` ✅
- `Lighthouse CI` (push): `22990437807` ✅
- `CodeQL` (push): `22990437831` ✅
- `Deploy Worker` (push): `22990437803` ✅

## Diagnostics Scan Summary (Desktop + Mobile)

Source artifacts:

- `/tmp/system-scan-v2-desktop.json`
- `/tmp/system-scan-v2-mobile.json`

Desktop summary:

- `totalEntries`: `32`
- `failingEntries`: `0`
- `routesWith500`: `0`
- `redirectLoops`: `0`
- `deadActions`: `0`
- `banners`: `0`
- `failedRequests`: `0`
- `pageErrors`: `0`
- `consoleErrors`: `0`

Mobile summary:

- `totalEntries`: `32`
- `failingEntries`: `0`
- `routesWith500`: `0`
- `redirectLoops`: `0`
- `deadActions`: `0`
- `banners`: `0`
- `failedRequests`: `0`
- `pageErrors`: `0`
- `consoleErrors`: `0`

## Vercel Production Verification

- Project linked: `kostasuser01gr/internal-tool-kit-ops`
- Production alias: `https://internal-tool-kit-ops.vercel.app`
- Deployment URL: `https://internal-tool-kit-iono1bwot-kostasuser01gr.vercel.app`
- `vercel logs --environment production --since 60m --level error`: no error logs returned

Contract checks:

- `GET /login` -> `200` with `content-type: text/html; charset=utf-8`
- `GET /api/health` -> `200` with `content-type: application/json` (no redirect)

## Replit Steps (Pull/Sync, Secrets, Run, Deploy)

### 1) Pull/sync in Replit shell

```bash
git fetch origin
git checkout main
git pull --rebase origin main
```

If conflicts occur:

```bash
git status
# resolve files
git add <resolved-files>
git rebase --continue
```

### 2) Required secret NAMES (Replit Secrets UI)

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `CRON_SECRET` (recommended)
- `KIOSK_TOKEN` (kiosk write access only)
- `KIOSK_STATION_ID` (optional)
- `NEXT_PUBLIC_API_URL` (if external API endpoint is used)
- `NEXT_PUBLIC_CONVEX_URL` (only if Convex realtime is enabled)
- `CONVEX_DEPLOYMENT` (only if Convex realtime is enabled)

### 3) Install / build / run

```bash
pnpm -w install
pnpm --filter @internal-toolkit/web build
pnpm --filter @internal-toolkit/web start -- -p $PORT -H 0.0.0.0
```

Use `PORT=5000` in Replit.

### 4) Optional deploy-script shortcuts

```bash
pnpm build:deploy
PORT="${PORT:-5000}" pnpm start:deploy
```
