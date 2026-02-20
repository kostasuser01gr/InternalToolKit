# Deploying Web App on Vercel + Supabase Postgres

This app must use a durable Postgres database in hosted environments.
Do not use `file:` sqlite URLs in Vercel.

## Required environment variables

Set these in **Vercel Preview + Production**:

- `DATABASE_URL`  
  Supabase **Transaction pooler** URI (serverless runtime, typically port `6543`).
- `DIRECT_URL`  
  Supabase **Direct connection** URI (migrations, typically port `5432`).
- `SESSION_SECRET`  
  Random secret with length **>= 32**.

## Supabase connection string mapping

- Runtime queries: `DATABASE_URL` (pooler / PgBouncer / `6543`)
- Migrations: `DIRECT_URL` (direct Postgres / `5432`)

## Important Vercel behavior

Changing environment variables does **not** update already-built deployments.
After any env var update, create a **new deployment** (redeploy).

## Go-live checklist

1. Set `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET` for Preview + Production in Vercel.
2. Redeploy the app.
3. Run production migrations once:
   - `pnpm -C apps/web db:migrate:deploy`
4. Verify health endpoint:
   - `GET /api/health` should return `{ "ok": true, "db": "ok" }`.
5. Verify auth flow:
   - Signup with Name + 4-digit PIN.
   - Login with the same credentials.
   - Refresh and confirm session persists.
