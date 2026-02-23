# Vercel Deployment Guide

## Prerequisites
- [Vercel CLI](https://vercel.com/docs/cli) installed (`vercel --version`)
- Access to the InternalToolKit Vercel project

## 1. Authenticate
```bash
vercel login
```

## 2. Link Project
```bash
cd /path/to/InternalToolKit-ops
vercel link
```
- Scope: your Vercel account
- Project: `internal-tool-kit-web` (or create new)
- Root directory: `apps/web`

## 3. Set Environment Variables

### Required (Production + Preview)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooler URI (port 6543) |
| `DIRECT_URL` | Supabase direct URI (port 5432) |
| `SESSION_SECRET` | Random >=32 chars |
| `CRON_SECRET` | Protects `/api/cron/*` endpoints |

### Optional
| Variable | Description |
|---|---|
| `KIOSK_TOKEN` | Washer kiosk write-access token |
| `KIOSK_STATION_ID` | Kiosk station identifier |
| `FEATURE_VIBER_BRIDGE` | Enable Viber bridge (`0`/`1`) |
| `VIBER_BOT_TOKEN` | Viber bot API token |
| `VIBER_TARGET_GROUP_ID` | Viber target group |
| `VIBER_WEBHOOK_SECRET` | Viber webhook secret |

### Add via CLI
```bash
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add SESSION_SECRET production
vercel env add CRON_SECRET production
```

### Pull to Local
```bash
vercel env pull .env.vercel.local
```

## 4. Build
```bash
vercel build
```
The build command (from `vercel.json`) runs migrations with soft-fail:
```
node scripts/migrate-deploy.mjs || echo '[warn] migrate-deploy failed'; pnpm run build
```

## 5. Deploy
```bash
vercel deploy --prod
```

## 6. Verify
```bash
vercel logs <DEPLOYMENT_URL> --since 60m
```

## Cron Jobs (Production Only)
Defined in `apps/web/vercel.json`:
| Path | Schedule | Description |
|---|---|---|
| `/api/cron/daily` | `0 6 * * *` | Daily digest |
| `/api/cron/feeds` | `0 7 * * *` | RSS feed refresh |
| `/api/cron/weather` | `0 5 * * *` | Weather data update |
| `/api/cron/housekeeping` | `0 3 * * *` | SLA checks, cleanup |

## Key Routes to Verify
- `/chat` — Ops chat
- `/fleet` — Fleet management
- `/washers` — Washer dashboard
- `/washers/app` — Kiosk app
- `/imports` — Data imports
- `/feeds` — RSS feeds
- `/search` — Global search
- `/weather` — Weather widget
- `/settings` — Settings
- `/calendar` — Calendar

## Troubleshooting
- **Build fails with P1001**: Direct DB port 5432 unreachable from Vercel. The build has soft-fail — app still deploys with existing schema.
- **Missing env vars**: Check `vercel env ls` and compare with `.env.example`.
- **Cron not firing**: Crons only run in production deployments, not preview.
