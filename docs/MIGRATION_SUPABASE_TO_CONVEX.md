# Migration: Supabase/Prisma → Convex

## Overview

Migrate backend persistence from Supabase-hosted PostgreSQL (via Prisma ORM) to Convex as the primary database + backend functions platform.

### Why
- Supabase connection pooler (Supavisor) returns "Tenant or user not found" — both projects affected
- Direct connection is IPv6-only; Vercel serverless is IPv4-only → unreachable
- Convex provides a fully managed backend with built-in serverless functions, eliminating connection issues

## Current Architecture

| Layer | Technology |
|---|---|
| Database | Supabase PostgreSQL (EU West Ireland) |
| ORM | Prisma v7.4.0 with `@prisma/adapter-pg` |
| Connection | `DATABASE_URL` (pooler) + `DIRECT_URL` (direct) failover via `db-failover.ts` |
| Auth | Custom cookie-based sessions (`uit_session`) with HMAC-SHA256 signing |
| API | Next.js Server Actions + API Routes |

## Data Models (57 models, 32 enums)

### Core
- `User` — auth, preferences, relations to all modules
- `Workspace` — multi-tenant container
- `WorkspaceMember` — role-based membership (ADMIN/EDITOR/EMPLOYEE/WASHER/VIEWER)
- `AuthSession` — session tokens with hash, expiry, revocation
- `InviteToken`, `PasswordResetToken`, `AuthThrottle` — auth flow
- `SecurityEvent` — audit trail for security events

### Data Platform
- `Table`, `Field`, `Record`, `View` — programmable data tables
- `Automation`, `AutomationRun` — legacy automations
- `AutomationRule`, `AutomationExecution` — v2 rule engine

### Communication
- `ChatChannel`, `ChatChannelMember` — Viber-like channels
- `ChatThread`, `ChatMessage` — threaded messaging with replies
- `ChatArtifact` — message artifacts (markdown/json/task/report)
- `ChatReadReceipt`, `ChatReaction` — engagement tracking

### Operations
- `Shift`, `ShiftRequest` — workforce scheduling
- `Vehicle`, `VehicleEvent` — fleet management
- `VehicleQcLog`, `VehicleBlocker`, `KeyHandoverLog` — fleet pipeline
- `WasherTask` — wash task queue
- `Incident` — damage/incident tracking
- `Attendance`, `Skill`, `UserSkill`, `Training`, `TrainingRecord` — workforce ops
- `Asset`, `AssetHandover` — inventory/keys

### Intelligence
- `FeedSource`, `FeedItem` — RSS/feed scanning
- `ImportBatch`, `ImportChangeSet` — file import pipeline
- `WeatherCache` — weather data cache
- `CronRun`, `DeadLetterEntry` — cron job tracking

### User Experience
- `UserShortcut`, `UserActionButton` — quick actions
- `PromptTemplate`, `AiUsageMeter` — AI assistant
- `SavedView`, `Runbook` — saved queries and runbooks
- `Notification`, `AuditLog` — notifications and audit
- `Station` — multi-station support
- `RetentionPolicy`, `AccessReview` — compliance

## File Impact

| Category | Files | Examples |
|---|---|---|
| Prisma client imports | 59 | validators, actions, API routes, libs |
| Server actions | 20 | `app/(app)/*/actions.ts` |
| API routes | 29 | `app/api/**` |
| DB connection | 2 | `lib/db.ts`, `lib/db-failover.ts` |
| Auth | 8 | `lib/auth/*` |
| Env validation | 3 | `lib/env.ts`, scripts |

## Migration Strategy

### Adapter Pattern (Minimal Invasive)
Instead of rewriting all 59 files that import Prisma, create a **Convex adapter** that implements a Prisma-compatible API surface:

1. Create `convex/` directory with schema + functions
2. Create `lib/db-convex.ts` adapter that wraps Convex client calls
3. Replace `lib/db.ts` to use Convex instead of Prisma
4. Keep server actions and API routes largely unchanged

### Phase Sequence
1. **Init Convex** — setup project, install packages, wire provider
2. **Schema** — define all tables in `convex/schema.ts`
3. **Auth** — login/signup/session in Convex
4. **RBAC + Audit** — permission checks + audit logging
5. **Modules** — migrate each module's data access
6. **Cleanup** — remove Prisma/Supabase dependencies
7. **Deploy** — Convex + Vercel production

## Risks
- **Data migration**: Existing Supabase data needs to be exported and imported into Convex
- **Query complexity**: Prisma's `include`/`select` joins may need Convex-side denormalization
- **Full-text search**: Postgres FTS/pg_trgm → Convex search indexes (different capabilities)
- **Cron**: Vercel cron → Convex scheduled functions
- **Transaction semantics**: Prisma transactions → Convex mutations (single-document atomicity, multi-document via helper patterns)
