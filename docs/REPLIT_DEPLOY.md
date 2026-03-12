# Replit Deploy Guide

## Required Secret Names (no values)

Set these in the Replit Secrets UI for the Repl:

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `CRON_SECRET` (recommended)
- `KIOSK_TOKEN` (required only if kiosk write access is enabled)
- `KIOSK_STATION_ID` (optional)
- `NEXT_PUBLIC_API_URL` (if external API endpoint is used)
- `NEXT_PUBLIC_CONVEX_URL` (only if Convex realtime is enabled)
- `CONVEX_DEPLOYMENT` (only if Convex realtime is enabled)

## Replit Shell Commands

```bash
pnpm -w install
pnpm --filter @internal-toolkit/web build
pnpm --filter @internal-toolkit/web start -- -p $PORT -H 0.0.0.0
```

`PORT` should be set to `5000` in Replit.

## Optional Deploy Scripts

From repo root:

```bash
pnpm build:deploy
PORT="${PORT:-5000}" pnpm start:deploy
```

## Pull / Sync and Conflict Resolution

1. Save local work before sync.
2. Pull latest:
   `git pull --rebase origin main`
3. If conflicts occur:
   - Resolve conflicted files.
   - Run `git add <file>` on resolved files.
   - Continue rebase: `git rebase --continue`
4. Re-run build/start commands above.

## Troubleshooting

### Port binding issues

- Confirm runtime starts with `-p $PORT -H 0.0.0.0`.
- Confirm Replit `PORT` is set to `5000`.

### Database migration/runtime drift

- Run migrations in the shell:
  `pnpm --filter @internal-toolkit/web db:migrate:deploy`
- Re-run build:
  `pnpm --filter @internal-toolkit/web build`

### Missing environment names

- Validate names locally:
  `pnpm --filter @internal-toolkit/web env:check`
- Add missing names in Replit Secrets UI and restart the run.
