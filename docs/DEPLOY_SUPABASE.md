# Supabase Deployment Guide

## Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`supabase --version`)
- Access to the InternalToolKit Supabase project

## 1. Authenticate
```bash
supabase login
```

## 2. List Projects
```bash
supabase projects list
```
Identify the correct project (region: West EU / Ireland).

## 3. Link Local Repo
```bash
supabase link --project-ref <PROJECT_REF>
```
> Project ref is the alphanumeric ID in your Supabase dashboard URL.

## 4. Verify Connection
```bash
supabase status        # requires Docker for local dev
supabase db remote commit  # optional: pull remote schema changes
```

## 5. Migration Approach (Prisma)

This repo uses **Prisma** for schema management (not Supabase migrations).

### Apply Migrations to Remote DB
```bash
cd apps/web
pnpm db:migrate:deploy
```
This runs `scripts/migrate-deploy.mjs`, which:
1. Requires `DIRECT_URL` (Supabase direct connection, port 5432)
2. Runs `prisma migrate deploy` against the direct connection

### Check Migration Status
```bash
cd apps/web
pnpm db:migrate:status
```

### Development Workflow
```bash
cd apps/web
pnpm db:migrate:dev    # create new migration
pnpm db:push:dev       # push schema without migration (prototyping only)
```

## Required Env Vars (names only)
| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `.env.local` + Vercel | Pooler URI (port 6543, pgBouncer) |
| `DIRECT_URL` | `.env.local` + Vercel | Direct URI (port 5432, migrations) |

## Troubleshooting
- **P1001 connection timeout**: Supabase direct port 5432 may be blocked. Use pooler URI or deploy from a network with access.
- **Docker not running**: `supabase status` requires Docker locally. Remote operations (link, db push) work without Docker.
- **Migration conflicts**: Run `prisma migrate resolve --rolled-back <name>` to skip failed migrations.
