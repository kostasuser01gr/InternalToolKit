# ADR: Database Migrations Strategy

- Status: Accepted
- Date: 2026-02-19

## Context
Schema drift occurred when runtime schema changed without controlled migration application.
Build-time schema syncing (`db push`) is unsafe for production because it bypasses reviewed migration history.

## Decision
Adopt migration-first discipline with checked-in Prisma migrations.

- Never run `prisma db push` in build or deploy flows.
- Development schema evolution:
  - `pnpm --filter @internal-toolkit/web db:migrate:dev`
- CI/staging/production schema application:
  - `pnpm --filter @internal-toolkit/web db:migrate:deploy`
- CI includes an explicit migration deploy step before lint/type/test/build.

## Operational Notes
- `apps/web/scripts/migrate-deploy.mjs` runs `prisma migrate deploy`.
- For fresh local SQLite only, if Prisma schema engine fails, a guarded fallback applies checked-in SQL migrations via `sqlite3`.
- This fallback is local-dev continuity only; production must use normal `migrate deploy`.

## Minimal Migration SOP
1. Create schema change in `apps/web/prisma/schema.prisma`.
2. Generate migration locally with `db:migrate:dev` and review SQL.
3. Commit migration directory in `apps/web/prisma/migrations`.
4. In CI/staging/prod, run `db:migrate:deploy` before app startup.
5. Verify migration status: `pnpm --filter @internal-toolkit/web db:migrate:status`.

## Rollback / Restore Note
Prisma migrations are forward-only. Rollback is restore-based:
1. Take DB backup/snapshot before deploy.
2. If release is bad, redeploy previous app revision.
3. Restore DB snapshot to pre-migration state.
4. Re-run `db:migrate:status` and smoke tests.
