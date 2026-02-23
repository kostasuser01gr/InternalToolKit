# Connections Setup Proof

> Generated: 2026-02-23  
> Repo: `kostasuser01gr/InternalToolKit`

---

## Tool Versions
| Tool | Version |
|---|---|
| Node.js | v20.20.0 |
| pnpm | 10.17.1 |
| GitHub CLI | 2.87.0 |
| Vercel CLI | 50.22.0 |
| Supabase CLI | 2.75.0 |
| Wrangler | 4.66.0 |

---

## GitHub CLI
- **Auth**: ✅ Logged in as `kostasuser01gr` (keyring)
- **Token scopes**: `gist`, `read:org`, `repo`, `workflow`
- **Latest CI runs**:

| Run ID | Title | Status | Workflow |
|---|---|---|---|
| 22303408703 | feat: wave 12 — import parsing, fleet SLA... | ✅ Passed | CI |
| 22303408752 | feat: wave 12 — import parsing, fleet SLA... | ✅ Passed | Deploy Worker |
| 22297605683 | docs: update PROOF_PACK with CI verification | ✅ Passed | CI |
| 22297245460 | fix: add migration for Ops OS schema changes | ✅ Passed | CI |

---

## Supabase
- **Project**: `internaltoolkit`
- **Project Ref**: `xtawoqzaeuvaelnruotc`
- **Region**: West EU (Ireland)
- **Linked**: ✅ via `supabase link --project-ref xtawoqzaeuvaelnruotc`
- **Migration tool**: Prisma (`prisma migrate deploy` via `scripts/migrate-deploy.mjs`)
- **Migration result**: ✅ 12 migrations applied, schema up to date
- **DB connectivity**: ✅ Reachable via direct connection (port 5432)
- **Note**: Pooler (port 6543) not reachable from local network; direct connection used for migrations

---

## Vercel
- **Auth**: ✅ Logged in as `kostasuser01gr`
- **Project**: `internal-toolkit-ops`
- **Linked**: ✅ via `.vercel/project.json`
- **Root directory**: `apps/web`

### Environment Variables (names only)
| Variable | Production | Preview | Development |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ |
| `DIRECT_URL` | ✅ | ✅ | ✅ |
| `SESSION_SECRET` | ✅ | ✅ | ✅ |
| `CRON_SECRET` | ✅ | ✅ | ✅ |

### Build
- **Result**: ✅ Compiled successfully (Next.js 16.1.6 + Turbopack)
- **TypeScript**: ✅ Passed (5.6s)
- **Static pages**: 57 generated
- **Build time**: ~27s

### Deployment
- **Production URL**: `https://internal-toolkit-ckjgjxx2k-kostasuser01gr.vercel.app`
- **Status**: ✅ Ready
- **Deployment protection**: Active (Vercel SSO)

### Cron Jobs (vercel.json)
| Path | Schedule | Description |
|---|---|---|
| `/api/cron/daily` | `0 6 * * *` | Daily digest (6am UTC) |
| `/api/cron/feeds` | `0 7 * * *` | RSS feed refresh (7am UTC) |
| `/api/cron/weather` | `0 5 * * *` | Weather update (5am UTC) |
| `/api/cron/housekeeping` | `0 3 * * *` | SLA checks, cleanup (3am UTC) |

---

## Cloudflare Worker
- **Worker**: `internaltoolkit-api`
- **URL**: `https://internaltoolkit-api.dataos-api.workers.dev`
- **Status**: ✅ Deployed
- **Version ID**: `520674af-254a-40dd-bc14-c7259d5d9114`
- **Size**: 551.83 KiB / gzip: 82.61 KiB
- **Startup time**: 22ms

---

## Files Created/Updated

### New files
| File | Purpose | Committed |
|---|---|---|
| `apps/web/scripts/validate-env.ts` | Checks required env vars (names only) | ✅ |
| `apps/web/scripts/setup-local-env.ts` | Interactive local env setup (no echo) | ✅ |
| `docs/DEPLOY_SUPABASE.md` | Supabase deployment guide | ✅ |
| `docs/DEPLOY_VERCEL.md` | Vercel deployment guide | ✅ |
| `docs/POST_DEPLOY_CHECKLIST.md` | Post-deploy verification checklist | ✅ |
| `docs/CONNECTIONS_SETUP_PROOF.md` | This file | ✅ |

### Updated files
| File | Change |
|---|---|
| `.gitignore` | Added `supabase/.branches/` |
| `apps/web/.env.example` | Reorganized with sections, added CRON_SECRET, FEEDS_*, WEATHER_*, SEARCH_* |
| `apps/web/package.json` | Added `env:check` and `env:setup` scripts |

### Gitignored files (not committed)
| File | Purpose |
|---|---|
| `apps/web/.env.local` | Local env vars (DATABASE_URL, DIRECT_URL, SESSION_SECRET, CRON_SECRET) |
| `apps/web/.env.vercel.local` | Pulled from Vercel (development env) |

---

## Remaining Items
- [ ] `KIOSK_TOKEN` — optional, add when washer kiosk is in use
- [ ] `VIBER_*` vars — optional, add when Viber bridge is enabled
- [ ] Update `ALLOWED_ORIGINS` in Cloudflare Worker for production Vercel URL
- [ ] Disable Vercel Deployment Protection for production (if public access needed)

---

## Key Routes Checklist (manual verification)
- [ ] `/login` — Login page
- [ ] `/chat` — Ops chat
- [ ] `/fleet` — Fleet management
- [ ] `/washers` — Washer dashboard
- [ ] `/washers/app` — Kiosk app
- [ ] `/imports` — Data imports
- [ ] `/feeds` — RSS feeds
- [ ] `/search` — Global search
- [ ] `/weather` — Weather widget
- [ ] `/settings` — Settings
- [ ] `/calendar` — Calendar
