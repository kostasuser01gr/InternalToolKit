# ADR-0001: Storage Strategy for Internal Dashboard Template

- Status: Accepted
- Date: 2026-02-18

## Context
The template currently uses Prisma + SQLite/LibSQL adapter in web flows and an in-memory audit repository in the worker for lightweight API examples. We need a practical default that is low-friction for onboarding and still production-upgradable.

## Decision
Adopt a staged storage strategy:
1. Default template storage:
   - Web: Prisma + SQLite/LibSQL for local-first and reproducible CI.
   - Worker: stateless API handlers with clear interfaces and strict validation.
2. Production recommendation:
   - Cloudflare D1/KV for worker-native persistence and low-latency edge writes where needed.
   - Keep Prisma-backed relational data model for richer dashboard workflows where relational queries are useful.

## Options Considered

### Option A: Cloudflare D1/KV everywhere
- Pros: edge-native, single deploy surface.
- Cons: migration complexity for existing Prisma-rich app flows.

### Option B: Postgres everywhere
- Pros: strong relational semantics.
- Cons: heavier infra requirement for template users.

### Option C (Chosen): hybrid template-first strategy
- Pros: fastest onboarding, no paid dependency required for local runs, clear upgrade path.
- Cons: dual-stack persistence concerns if both paths grow without consolidation.

## Consequences
- Template remains runnable with minimal local setup.
- Production teams can promote worker persistence to D1/KV while retaining web data model ergonomics.
- Documentation must clearly describe migration and secret/env responsibilities.
