# AuthFix Report

## Symptom
- Production returned `500` on auth pages/routes.
- Users could sign up in some runs, then fail to log in afterward.

## Reproduction
1. Vercel runtime logs showed:
   - `Invalid environment configuration. DATABASE_URL must not use a local sqlite file in hosted production.`
2. Production env had `DATABASE_URL="file:./prisma/runtime.sqlite"`.
3. Local control flow (`signup -> login`) succeeded when both requests hit the same process, confirming auth logic itself was functional.

## Root Cause
- Hosted runtime was configured to a file-based sqlite URL (`file:...`), which is non-durable/invalid for this deployment model.
- This produced production 500s and non-deterministic auth persistence behavior.

## Fix Summary
- Migrated web datasource to **Postgres** (Supabase-compatible) in Prisma schema/config.
- Removed sqlite/libsql runtime adapter usage from app DB client and seed path.
- Replaced sqlite migration/reset fallbacks with Prisma Postgres migration/reset scripts.
- Enforced hosted env requirements for:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `SESSION_SECRET`
- Kept auth UX/flows unchanged (`loginName + 4-digit PIN` + compatibility email/password).
- Added/kept regression coverage for signup/login and PIN leading-zero behavior.

## Files Changed (Auth/DB-critical)
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma.config.ts`
- `apps/web/lib/db.ts`
- `apps/web/lib/env.ts`
- `apps/web/prisma/seed.ts`
- `apps/web/scripts/migrate-deploy.mjs`
- `apps/web/scripts/reset-db.mjs`
- `apps/web/tests/unit/auth-signin.test.ts`
- `apps/web/tests/smoke.spec.ts`

## Vercel Env Vars (required)
Set for **Preview + Production**:
- `DATABASE_URL` = Supabase pooled URI (runtime)
- `DIRECT_URL` = Supabase direct URI (migrations)
- `SESSION_SECRET` = strong random secret (>=16 chars)

After setting vars, redeploy:
```bash
vercel --prod --yes
```
