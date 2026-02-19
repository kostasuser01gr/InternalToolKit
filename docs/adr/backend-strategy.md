# ADR: Canonical Backend Strategy

- Status: Accepted
- Date: 2026-02-19

## Context
The monorepo currently has two backend-capable surfaces:
- `apps/web` (Next.js route handlers + server actions with Prisma-backed data model)
- `apps/api` (Cloudflare Worker endpoints)

Without a canonical boundary, business logic and RBAC checks drift across both paths.

A Worker-first canonical backend would require replacing Prisma-backed relational flows (or introducing edge proxy/runtime constraints) before parity is safe.

## Decision
Choose **Web-only canonical backend** for product data and auth.

- Canonical mutations and reads for product data live in `apps/web` route handlers/server actions.
- RBAC is enforced at the canonical boundary in web (`requireWorkspaceRole`, `requireAdminAccess`, `requireSession`).
- `apps/api` remains a non-canonical edge surface for health/integration-style endpoints.

## Guardrails and Deprecation
- Worker mutation compatibility endpoints are hard-disabled by default via `ALLOW_LEGACY_MUTATIONS=0`.
- Disabled endpoints return `410` with an explicit migration message.
- Hard deprecation deadline for legacy Worker mutation endpoints: **2026-06-30**.

## Module Boundaries
- `apps/web/lib/*` owns domain services, auth lifecycle, sessions, and audit/security persistence.
- `apps/api/src/index.ts` must not become an alternate source of truth for product mutations.
- Shared request/response contracts stay in `packages/shared`.

## Consequences
- Eliminates duplicate auth/RBAC logic across backend surfaces.
- Keeps local/dev and Vercel deployment path consistent with current Prisma schema.
- Worker remains deployable and observable, but not the canonical mutation plane.
