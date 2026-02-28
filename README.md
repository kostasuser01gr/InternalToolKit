# InternalToolKit

> Premium internal operations platform — a cross-device quantum-themed dashboard for fleet management, shift planning, washer operations, team chat, real-time feeds, and more.

**Production URL**: `https://internal-tool-kit-web.vercel.app`
**CI Status**: All workflows GREEN ✅ (CI · Lighthouse CI · CodeQL)
**190 commits** · **57 Prisma models** · **29+ app routes** · **583 unit tests** · **42+ E2E tests**

---

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Architecture](#architecture)
- [Feature Modules](#feature-modules)
- [Development Journey — What We Built](#development-journey--what-we-built)
- [Tech Stack](#tech-stack)
- [Quickstart](#quickstart)
- [Run / Test / Build](#run--test--build)
- [Test Infrastructure](#test-infrastructure)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Auth & Security](#auth--security)
- [Root Causes Fixed — Full Remediation History](#root-causes-fixed--full-remediation-history)
- [Documentation Index](#documentation-index)

---

## What This Project Does

InternalToolKit is a **full-featured internal operations platform** designed for companies managing physical assets, teams, and workflows. It provides:

- **Fleet Management**: Track vehicles with plate numbers, mileage, fuel levels, service events, SLA monitoring, and bulk operations.
- **Shift Planning**: Weekly board with drag-and-drop scheduling, shift requests with approval flows, CSV import/export, and calendar integration.
- **Washer Operations**: Task queues with KPI dashboards, a standalone kiosk app for field workers, daily registers, and voice note support.
- **Team Chat**: Unified workspace with threaded conversations, slash commands, AI assistant integration, artifact sharing, and pinned context.
- **News Feeds**: RSS/Atom source management with keyword scoring, auto-pinning, Viber channel mirroring, and cron-driven refresh.
- **Data Tables**: Programmable tables with inline editing, virtual scrolling, field management, and CSV export.
- **Imports**: File upload with parsing, validation preview, and batch data ingestion.
- **Calendar**: Unified timeline aggregating shifts, fleet events, washer tasks, and custom entries.
- **Analytics & Reports**: KPI dashboards, activity logs, compliance views, and PDF report generation.
- **Admin Panel**: User/workspace management, RBAC governance, usage limits, and feature flag control.
- **Automations**: Rule-based automation engine with triggers, conditions, actions, and execution logs.
- **Notifications & Ops Inbox**: Real-time notification center and operational inbox with action buttons.
- **Global Search**: Full-text search with PostgreSQL trigram indexes across all entities.
- **Command Palette**: Keyboard-driven navigation (`Ctrl+K`) with fuzzy search and shortcut sequences.
- **Quantum Theming**: Three premium color themes (violet/cyan/amber) with dark/light mode and glass-morphism UI.

All of this runs as a **monorepo** deployed to **Vercel** (web) with **Convex** as the real-time backend and **PostgreSQL** (via Prisma) as the relational data store.

---

## Architecture

```text
InternalToolKit-ops/
├── apps/
│   ├── web/                    # Next.js 15 App Router (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/         # Login, signup, forgot/reset password
│   │   │   ├── (app)/          # 29 protected app routes
│   │   │   ├── (kiosk)/        # Washer kiosk standalone app
│   │   │   └── api/            # REST endpoints (health, session, search, etc.)
│   │   ├── components/         # UI components (glass cards, KPI tiles, etc.)
│   │   ├── lib/                # Auth, RBAC, DB, Convex, utilities
│   │   ├── prisma/             # Schema (57 models) + 13 migrations
│   │   └── tests/              # Unit (43 files) + E2E (5 specs) + diagnostics
│   └── api/                    # Cloudflare Worker (non-canonical, health only)
├── packages/
│   └── shared/                 # TypeScript + Zod contracts
├── convex/                     # Convex backend (schema, auth, users, workspaces)
├── docs/                       # 50+ documentation files
├── .github/workflows/          # 5 CI workflows
└── lighthouserc.js             # Lighthouse CI config
```

### Request Flow

```
Browser → Vercel Edge (middleware/proxy.ts)
  ├─ Auth check (cookie session with HMAC signature)
  ├─ CSP headers injection (per-request nonce)
  ├─ Rate limiting (IP + account + device dimensions)
  └─ Route to:
       ├─ Server Components (SSR with DB queries)
       ├─ Server Actions (mutations with revalidation)
       ├─ API Route Handlers (/api/*)
       └─ Convex (real-time subscriptions via React provider)
```

---

## Feature Modules

| Module | Route(s) | Key Features |
|--------|----------|--------------|
| **Auth** | `/login`, `/signup`, `/forgot-password`, `/reset-password` | PIN + password dual auth, bcrypt hashing, HMAC session cookies, throttle/lockout |
| **Home/Overview** | `/home`, `/overview` | Dashboard with weather widget (geolocation), KPI cards, quick actions |
| **Chat** | `/chat` | Threaded conversations, slash commands, AI assistant, artifact sharing |
| **Fleet** | `/fleet` | Vehicle CRUD, inline editing, bulk ops, event logging, VirtualTable |
| **Washers** | `/washers`, `/washers/app` | Task queue, KPI dashboard, kiosk mode (standalone), daily register |
| **Shifts** | `/shifts` | Weekly board, drag-drop, request/approve flow, CSV import/export |
| **Calendar** | `/calendar` | Unified timeline, date range picker, multi-source aggregation |
| **Data** | `/data` | Programmable tables, field management, inline edit, CSV export |
| **Feeds** | `/feeds` | RSS/Atom sources, keyword scoring, auto-pin, cron refresh |
| **Imports** | `/imports` | File upload, parse preview, validation, batch ingestion |
| **Analytics** | `/analytics` | KPI dashboards, trend charts, performance metrics |
| **Reports** | `/reports` | Filterable reports, PDF generation |
| **Activity** | `/activity` | Audit log viewer with actor/action/target filtering |
| **Admin** | `/admin` | User management, RBAC, usage limits, workspace settings |
| **Settings** | `/settings` | Profile, theme preferences, custom shortcuts, quick actions |
| **Notifications** | `/notifications` | Real-time notification center, mark read/unread |
| **Ops Inbox** | `/ops-inbox` | Operational inbox with action buttons and badge counts |
| **Automations** | `/automations` | Rule engine with triggers, conditions, actions |
| **Controls** | `/controls` | Operational controls and system status |
| **Assistant** | `/assistant` | AI chat assistant with provider abstraction |
| **Components** | `/components` | Showroom/design system showcase |
| **Search** | `/search` | Global full-text search (pg_trgm) |
| **Dashboard** | `/dashboard` | Alternative dashboard view |
| **Command Palette** | (overlay) | `Ctrl+K` fuzzy search, `g+d` keyboard shortcuts |

---

## Development Journey — What We Built

This section chronicles the **complete build-out** of InternalToolKit from initial scaffold to production-ready platform, across 190 commits and multiple development phases.

### Phase 1: Foundation (Commits 1–15)

**Goal**: Establish monorepo structure, CI pipeline, and basic deployment.

- **Monorepo scaffold**: Created `apps/web` (Next.js), `apps/api` (Cloudflare Worker), `packages/shared` with pnpm workspaces.
- **CI pipeline**: GitHub Actions workflow with install → lint → typecheck → unit tests → build gates.
- **Vercel deployment**: Connected repo, configured build commands, set up env vars.
- **Prisma + PostgreSQL**: Initialized schema, first migration, database reset scripts.
- **Environment validation**: Fail-fast guards for missing `SESSION_SECRET`, `DATABASE_URL`; rejected SQLite in production.
- **Worker deployment**: Cloudflare Workers pipeline with wrangler, though web became the canonical backend.

### Phase 2: Authentication & Security (Commits 16–45)

**Goal**: Build a production-grade auth system with no shortcuts.

- **Dual auth modes**: `loginName + 4-digit PIN` (primary) and `email + password` (compatibility).
- **bcrypt hashing**: All credentials stored as bcrypt hashes, never plaintext.
- **HMAC session cookies**: Custom cookie-based sessions with `createHmac("sha256", secret)` signatures, expiry, and server-side validation.
- **Signup flow**: Account creation with workspace bootstrap, one-time invite tokens.
- **Password reset**: Token-based reset flow with session revocation.
- **Auth throttle**: IP + account + device dimension rate limiting with progressive lockouts, DB-backed for distributed safety.
- **Middleware (proxy.ts)**: Request interception for auth checks, CSP nonce injection, redirect handling. Excludes `/login`, `/api/*`, `/_next/*`, static assets.
- **Redirect loop prevention**: Extensive debugging to fix `ERR_TOO_MANY_REDIRECTS` — stale cookie clearing, tri-state proxy logic, single-redirect guarantee.
- **RBAC matrix**: Role-based access control with `platformOwner`, `coordinator`, `admin`, `viewer`, `employee`, `washer` roles and resource-level permissions.
- **Step-up verification**: Admin-destructive actions require PIN re-entry with short-lived elevated sessions.

### Phase 3: Core Modules — Chat, Fleet, Shifts, Washers (Commits 46–75)

**Goal**: Implement the four core operational modules.

- **Unified Chat**: Threaded workspace with thread CRUD, message send/edit/delete, slash commands (`/clear`, `/pin`, `/archive`), AI assistant integration via provider abstraction (OpenAI/Anthropic/mock), artifact sharing, and moderation rules.
- **Fleet Management**: Vehicle registry with plate/model/mileage/fuel tracking, event logging (service, accident, refuel), status transitions, inline editing with VirtualTable for performance.
- **Shift Planner**: Weekly board view with drag-and-drop move, shift creation/editing, request/approval workflow, CSV import/export, bulk operations.
- **Washer Operations**: Wash task queue with vehicle assignment, wash type selection, KPI dashboard (daily tasks, completion rate, avg time), daily register view.
- **Washer Kiosk Mode**: Standalone PWA-style app at `/washers/app` with simplified UI for field workers, quick plate input, service presets, action buttons.

### Phase 4: Data Platform & Feeds (Commits 76–100)

**Goal**: Add programmable data tables, feed aggregation, imports, and search.

- **Programmable Data Tables**: Dynamic table creation, field management (text/number/date/select), record CRUD, inline editing, CSV export, VirtualTable rendering for 1000+ rows.
- **Feed Aggregation**: RSS/Atom source management, keyword-based scoring with `keywordsJson` field, auto-pin high-scoring articles, cron-driven refresh (daily on Hobby plan), send-to-chat integration.
- **Import System**: File upload with drag-and-drop, parse preview showing detected columns, validation with error highlighting, batch ingestion into data tables.
- **Global Search**: PostgreSQL `pg_trgm` extension for fuzzy full-text search across all entities, search API endpoint, search page with results.
- **Weather Widget**: Browser geolocation with `navigator.geolocation`, cached in `sessionStorage`, deferred to `useEffect` to prevent SSR hydration mismatch.

### Phase 5: Real-Time & Integrations (Commits 101–130)

**Goal**: Wire Convex for real-time, add Viber bridge, automations, and notifications.

- **Convex Backend**: Schema with 50+ tables deployed to Convex, auth/users/workspaces functions, React provider integration with `ConvexProvider`, health endpoint returning `{"ok":true,"db":"convex"}`.
- **Viber Channel Mirror**: Feed articles mirrored to Viber channels via rich media messages with helpers.
- **Automation Engine**: Rule-based automations with trigger definitions, conditions, actions, execution logging, run-now capability.
- **Notifications**: Real-time notification center with mark-read/unread, mark-all-read, notification badge with count.
- **Ops Inbox**: Operational inbox aggregating actionable items with approve/decline/acknowledge action buttons, badge integration.
- **Integrations Wizard**: Setup wizard for connecting external services, status endpoint at `/api/integrations/status`.
- **Cron System**: Consolidated cron with dead-letter queue, retry with exponential backoff, DB persistence of `CronRun` records, production hardening.

### Phase 6: UI/UX Polish & Performance (Commits 131–155)

**Goal**: Premium UI, virtual scrolling, inline editing, and optimistic updates.

- **Quantum Theme System**: Three color themes (violet `#9a6fff`, cyan, amber) with CSS custom properties, glass-morphism surfaces (`glass-surface` class), glow shadows, gradient accents. Dark/light mode with `next-themes`.
- **VirtualTable**: Replaced standard tables with `@tanstack/react-virtual` for smooth scrolling of 1000+ rows across fleet, activity, washers, feeds, and daily register views.
- **Inline Editing**: Click-to-edit cells in fleet/shift tables with optimistic updates, server action mutations, and revalidation.
- **Bulk Operations**: Multi-select with bulk actions (fleet bulk update, shift bulk move, notification bulk mark-read).
- **Custom Shortcuts**: User-configurable quick actions and shortcuts with reordering (drag handles), persisted to DB with position field.
- **Command Palette**: `Ctrl+K` overlay with fuzzy search across all routes and actions, keyboard shortcut sequences (`g+d` → dashboard, `g+a` → analytics).
- **Skeleton Loading**: Shimmer loading states for all data-heavy pages.
- **PWA Manifest**: `manifest.json` with icons for install-to-homescreen.

### Phase 7: Ops OS Full-Scale Upgrade (Commits 156–170)

**Goal**: Enterprise features — compliance, incidents, inventory, workforce, stations.

- **Schema expansion**: Added models for `PipelineState`, `QualityCheck`, `Blocker`, `WeatherCache`, compliance, incidents, inventory, workforce, stations.
- **13 Prisma migrations**: Incremental schema evolution from init through ops OS upgrade.
- **Fleet SLA Cron**: Automated SLA monitoring with alerts for overdue services.
- **Import Parsing**: Enhanced file parsing with column detection, type inference, and error reporting.
- **Bookings**: Apply/approve flow for resource bookings.
- **Fleet Priority**: Priority scoring for fleet maintenance scheduling.
- **Feeds Rate Limiting**: Source-level rate limiting to respect RSS provider limits.

### Phase 8: Security & Observability (Commits 171–180)

**Goal**: Harden security posture and add observability tooling.

- **CSP (Content Security Policy)**: Full CSP headers via `proxy.ts` — `script-src` with per-request nonce + `strict-dynamic`, `style-src 'self' 'unsafe-inline'` (fixed nonce conflict), `frame-ancestors 'none'`, `form-action 'self'`.
- **CodeQL Analysis**: GitHub-native SAST scanning on every push, JavaScript/TypeScript analysis.
- **Dependency Review**: Automated PR blocking on known-vulnerable dependencies.
- **pnpm audit**: High/critical vulnerability scanning in CI.
- **Request hardening**: Rate limiting, CORS validation, request ID propagation.
- **Open redirect fix**: Middleware `callbackUrl` validation to prevent open redirect attacks.
- **Error boundaries**: React error boundaries on all route segments with graceful degradation when DB is unavailable.

### Phase 9: Test Infrastructure (Commits 181–190)

**Goal**: Comprehensive testing across unit, E2E, a11y, API contracts, Lighthouse, and full diagnostic scanning.

- **583 Unit Tests** (43 files): Auth signin, RBAC matrix, governance, rate limiting, DB failover, prisma errors, security, environment guards, weather, chat error handling, KPI calculations, redirect loops, settings schema, and more.
- **E2E Smoke Tests** (15 Desktop): Login gate, cookie validation, signup flow, responsive shell, command palette navigation, data table CRUD, admin gate, chat flow, shift planner, fleet flow.
- **E2E Module Tests** (15 Desktop): Washers page + KPIs + create task, imports page + upload form, feeds page + add sources, settings page + save profile, calendar page + date range, notifications, ops inbox, cross-module navigation.
- **Health/Contract Tests** (4): `/api/health` JSON shape, `/api/health/db` backend status, login no-redirect-loop, unauth redirect behavior.
- **API Contract Tests** (33 across 3 viewports): `/api/health`, `/api/health/db`, `/api/version`, `/api/search`, `/api/weather`, `/api/activity`, `/api/integrations/status`, `/api/session/logout`, `/api/ai/health`, login behavior, redirect behavior.
- **A11y Scans** (31): Axe accessibility audits on all HTML pages (not API routes), checking for critical/serious violations.
- **Lighthouse CI**: Performance/accessibility/best-practices audits on `/login` and `/` with 3 runs each, `--headless=new` Chrome flag, bounded retry loop for NO_FCP.
- **Full Diagnostic Scan** (27 routes × 3 viewports = 81 checks): Auto-discovers nav links, visits every route, captures console errors, network failures ≥400, redirect loops, crash banners, and click-audits up to 5 primary action buttons per page. Produces `full-scan-report.json`.

### Phase 10: CI Stabilization & Production Verification (Final)

**Goal**: Make every CI workflow reliably green and verify production.

Key fixes applied:
1. **CSP inline styles blocked** — removed nonce from `style-src` that silently disabled `unsafe-inline`.
2. **CSP dev scripts blocked** — added development-mode nonce handling.
3. **Hydration mismatches** — deferred `sessionStorage` reads to `useEffect` (weather widget), used `date-fns` for deterministic date formatting (shifts).
4. **Admin page false positive** — tightened 500-detection regex to word-boundary `\b500\b`.
5. **LHCI install failures** — added retry loop with pnpm fallback for npm 403 errors.
6. **Lighthouse NO_FCP** — switched to `--headless=new` Chrome flag for proper rendering.
7. **E2E CI flakes** — increased login timeout (7s → 20s), fleet/washers assertion timeouts (7s → 15s), command palette timeout (15s → 30s), added `networkidle` waits.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, React 19, Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS 4 + CSS custom properties + glass-morphism |
| **UI Components** | Radix UI (Dialog, Dropdown, Select, Tabs, Switch, etc.) |
| **Database** | PostgreSQL (Prisma ORM, 57 models, 13 migrations) |
| **Real-time** | Convex (50+ tables, subscriptions, server functions) |
| **Auth** | Custom HMAC cookie sessions + bcrypt + throttle |
| **Virtualization** | @tanstack/react-virtual (1000+ row tables) |
| **Monorepo** | pnpm workspaces |
| **Hosting** | Vercel (web) + Convex Cloud (backend) |
| **CI/CD** | GitHub Actions (5 workflows) |
| **Testing** | Vitest (unit) + Playwright (E2E) + Axe (a11y) + Lighthouse CI |
| **Security** | CodeQL + dependency review + pnpm audit |

---

## Quickstart

### Prerequisites

- Node.js 22+
- pnpm 10.x
- PostgreSQL 16 running locally (or Docker)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create local env file (never overwrites existing values)
pnpm --filter @internal-toolkit/web setup:env

# 3. Verify required env names
pnpm --filter @internal-toolkit/web env:check

# 4. Apply DB migrations
pnpm --filter @internal-toolkit/web db:migrate:deploy

# 5. Start development server
pnpm dev
```

**Default local endpoints:**
- Web: `http://127.0.0.1:3000`

**Seed users** (after `pnpm test:e2e` or `db:reset`):
| Login | PIN | Role |
|-------|-----|------|
| `admin` | `1234` | Platform Owner |
| `viewer` | `2222` | Viewer |
| `employee` | `3456` | Employee |
| `washer` | `7777` | Washer |

---

## Run / Test / Build

```bash
# Development
pnpm dev                    # Start web + api

# Quality gates
pnpm lint                   # ESLint (0 warnings)
pnpm typecheck              # TypeScript strict check
pnpm test:unit              # 583 Vitest unit tests
pnpm test:e2e               # Playwright E2E (smoke + modules)
pnpm test                   # Unit + E2E combined
pnpm build                  # Production build

# Specialized test suites
pnpm -C apps/web test:full-scan --project Desktop   # Full 27-route diagnostic scan
pnpm -C apps/web test:full-scan --project Mobile     # Mobile viewport scan
pnpm -C apps/web test:full-scan --project Tablet     # Tablet viewport scan
pnpm -C apps/web test:a11y                           # Axe accessibility audits
pnpm -C apps/web test:api                            # API contract tests

# Database
pnpm --filter @internal-toolkit/web db:migrate:dev      # Create migration
pnpm --filter @internal-toolkit/web db:migrate:deploy    # Apply migrations
pnpm --filter @internal-toolkit/web db:migrate:status    # Check migration status
pnpm --filter @internal-toolkit/web db:reset             # Reset + seed
```

---

## Test Infrastructure

### Test Suites Summary

| Suite | Files | Tests | What It Covers |
|-------|-------|-------|----------------|
| **Unit** | 43 | 583 | Auth, RBAC, governance, rate limiting, DB failover, security, KPIs, weather, chat, settings, env guards |
| **E2E Smoke** | 1 | 15 | Login, signup, navigation, command palette, data tables, admin gate, chat, shifts, fleet |
| **E2E Modules** | 1 | 15 | Washers, imports, feeds, settings, calendar, notifications, ops inbox, cross-module nav |
| **Health** | 1 | 4 | API health, DB status, redirect loop detection |
| **API Contracts** | 1 | 33 | All API endpoints shape validation (×3 viewports) |
| **A11y** | 1 | 31 | Axe critical/serious violation scans on HTML pages |
| **Full Scan** | 1 | 81 | Every route on Desktop + Tablet + Mobile, click audit, error capture |

### Full Diagnostic Scan (`full-scan.spec.ts`)

The most comprehensive test — 589 lines covering:

1. **Route inventory**: 4 auth + 22 app + 1 kiosk = 27 routes
2. **Per-route checks**: HTTP status, redirect loop detection (max 8), crash banner detection, console error capture, network failure capture
3. **Click audit**: Finds primary action buttons (Create/Save/Submit/Export/etc.), clicks each, asserts one of: navigation, network request, or UI change. Reports `DEAD_ACTION` if nothing happens.
4. **Auto-discovery**: Discovers nav links from sidebar/side-rail/bottom-nav and tests undiscovered routes too.
5. **3 viewports**: Desktop (1440×900), Tablet (iPad gen 7), Mobile (iPhone 14)

---

## CI/CD Pipeline

### Workflows (`.github/workflows/`)

| Workflow | Trigger | Gates |
|----------|---------|-------|
| **CI** (`ci.yml`) | push/PR to `main` | Install → migrate → lint → typecheck → unit tests → E2E smoke → API contracts → a11y → full diagnostic scan → build → dependency audit |
| **Lighthouse CI** (`lighthouse.yml`) | push/PR to `main` | Build → verify HTML → Lighthouse audit (3 runs on `/login` + `/`) |
| **CodeQL** (`codeql.yml`) | push/PR to `main` | JavaScript/TypeScript SAST analysis |
| **Dependency Review** (`dependency-review.yml`) | PR to `main` | Block PRs with known-vulnerable dependencies |
| **Deploy Worker** (`deploy-worker.yml`) | push to `main` | Wrangler deploy to Cloudflare (when secrets configured) |

### Current CI Status

All workflows green on latest commit `1481f43`:

| Workflow | Run ID | Status |
|----------|--------|--------|
| CI | 22410779203 | ✅ PASSED (15m 27s) |
| Lighthouse CI | 22410779140 | ✅ PASSED (5m 15s) |
| CodeQL | 22410779169 | ✅ PASSED (1m 47s) |

---

## Environment Variables

### Web (`apps/web/.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✅ hosted | HMAC signing key, ≥32 chars |
| `DATABASE_URL` | ✅ hosted | PostgreSQL connection (pooled) |
| `DIRECT_URL` | ✅ migrations | PostgreSQL connection (direct) |
| `CONVEX_DEPLOYMENT` | ✅ prod | Convex deployment identifier |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ prod | Convex public URL |
| `CRON_SECRET` | ✅ prod | Secret for cron endpoint auth |
| `ASSISTANT_PROVIDER` | optional | `mock` / `openai` / `anthropic` |
| `NEXT_PUBLIC_FEATURE_COMMAND_PALETTE` | optional | `1` to enable |
| `NEXT_PUBLIC_FEATURE_COMPONENTS_SHOWROOM` | optional | `1` to enable |
| `NEXT_PUBLIC_FEATURE_REPORTS_PDF` | optional | `1` to enable |

### Safe Env Setup (Local + Vercel)

- Local setup command: `pnpm --filter @internal-toolkit/web setup:env`
- Local validation command: `pnpm --filter @internal-toolkit/web env:check`
- The setup script only appends missing keys to `apps/web/.env.local`; it does not overwrite existing values.
- `DATABASE_URL`: Supabase pooled URI (Project Settings -> Database -> Connection string, port `6543`)
- `DIRECT_URL`: Supabase direct URI (Project Settings -> Database -> Connection string, port `5432`)
- `SESSION_SECRET`: generate locally with `openssl rand -hex 32`
- `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`: from Convex dashboard when Convex is enabled
- Vercel (names only, values entered interactively):
  - `vercel env ls`
  - `vercel env add DATABASE_URL production`
  - `vercel env add DATABASE_URL preview`
  - `vercel env add DIRECT_URL production`
  - `vercel env add DIRECT_URL preview`
  - `vercel env add SESSION_SECRET production`
  - `vercel env add SESSION_SECRET preview`

### Runtime Validation

- Fails fast when `SESSION_SECRET` or `DATABASE_URL` is missing in hosted environment
- Rejects `DATABASE_URL=file:...` (no SQLite in production)
- Requires `postgresql://` or `postgres://` protocol
- Automatic failover: retries with `DIRECT_URL` on DB connectivity errors

---

## Deployment

### Web → Vercel

1. Import repo in Vercel, set root to `apps/web`
2. Set environment variables (see above)
3. Auto-deploys from `main` branch
4. Production URL: `https://internal-tool-kit-web.vercel.app`

### Convex Backend

```bash
npx convex deploy    # Deploy to production
npx convex dev       # Local development
```

### Post-Deploy Verification

```bash
curl -sI https://internal-tool-kit-web.vercel.app/login     # 200 text/html
curl -s  https://internal-tool-kit-web.vercel.app/api/health # {"ok":true,"db":"convex"}
curl -s  https://internal-tool-kit-web.vercel.app/api/version # {"ok":true,"version":"1.0.0"}
```

---

## Auth & Security

| Feature | Implementation |
|---------|---------------|
| **Credential storage** | bcrypt hashes only, never plaintext |
| **Sessions** | HMAC-SHA256 signed cookies, DB-backed (`AuthSession`), server-validated |
| **Login throttle** | IP + account + device rate limiting, progressive lockout, DB-backed |
| **RBAC** | 6 roles × resource-level permissions, checked server-side |
| **CSP** | Per-request nonce, `strict-dynamic`, frame-ancestors `none` |
| **Step-up auth** | Admin-destructive actions require PIN re-verification |
| **Open redirect** | `callbackUrl` validation in middleware |
| **Password reset** | One-time tokens with expiry + session revocation |
| **Audit logging** | All auth events persisted with actor/action/target/IP |
| **CodeQL** | SAST on every push |
| **Dependency review** | PR-blocking for vulnerable deps |

---

## Root Causes Fixed — Full Remediation History

### P0 — Breaking Issues

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Every page renders without styles | CSP `style-src` had nonce that silently disabled `unsafe-inline` | Removed nonce from `style-src` |
| 2 | Dev server broken (scripts blocked) | CSP `script-src` nonce not applied in dev | Added dev-mode nonce handling |
| 3 | `ERR_TOO_MANY_REDIRECTS` in production | Stale session cookie + proxy tri-state logic | Clear stale cookie, single-redirect guarantee |
| 4 | Login returns 500 in production | Invalid DB config (SQLite URL in hosted env) | Enforced PostgreSQL-only + env validation |
| 5 | Signup fails after deploy | Hosted SQLite fallback causing auth failures | Removed SQLite path entirely |

### P1 — Functional Issues

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 6 | Weather widget hydration mismatch | `sessionStorage` read during SSR | Deferred to `useEffect` |
| 7 | Shifts date mismatch server/client | `toLocaleDateString()` non-deterministic | Used `date-fns format()` |
| 8 | Admin page false positive 500 | Regex `/500/i` matched "5000" in usage table | Word-boundary `\b500\b` |
| 9 | All SSR pages crash when DB down | No error boundary on DB calls | Added try/catch + graceful degradation |
| 10 | Dead clicks on form buttons | Missing pending states | Added `useFormStatus()` + disabled states |

### P2 — CI Stability

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 11 | LHCI install fails | npm 403 for `@lhci/cli` | Retry loop + pnpm fallback |
| 12 | Lighthouse NO_FCP | Legacy `--headless` can't paint | `--headless=new` Chrome flag |
| 13 | E2E login timeout | 7s default too short for CI runners | Increased to 20s |
| 14 | Fleet/washers assertion timeout | DB mutations slow on CI | 15s timeout + `networkidle` wait |
| 15 | Command palette race condition | `Promise.all` click+wait race | Sequential click then wait (30s) |

---

## Documentation Index

### Architecture & Decisions
- `docs/adr/backend-strategy.md` — Canonical backend strategy
- `docs/adr/migrations-strategy.md` — Migration SOP and rollback
- `docs/ADR-0001-storage.md` — Storage architecture decision
- `docs/architecture.md` — System architecture overview

### Operations
- `docs/DEPLOY.md` — Deployment guide
- `docs/DEPLOY_VERCEL.md` — Vercel-specific deployment
- `docs/DEPLOY_SUPABASE.md` — Supabase setup
- `docs/CRON_JOBS.md` — Cron job documentation
- `docs/POST_DEPLOY_CHECKLIST.md` — Post-deploy verification
- `docs/TROUBLESHOOTING.md` — Common issues and fixes

### Modules
- `docs/CHAT_VIBERLIKE.md` — Chat implementation
- `docs/FLEET_PIPELINE.md` — Fleet management
- `docs/FLEET_V2.md` — Fleet v2 features
- `docs/SHIFTS_WORKFLOW.md` — Shift planning
- `docs/WASHERS_DASHBOARD.md` — Washer operations
- `docs/WASHER_KIOSK.md` — Kiosk mode
- `docs/FEEDS.md` — Feed aggregation
- `docs/IMPORTS.md` — Import system
- `docs/SEARCH.md` — Global search
- `docs/WEATHER.md` — Weather integration

### Security & QA
- `docs/SECURITY.md` — Security posture
- `docs/SECURITY_POSTURE.md` — Detailed security analysis
- `docs/AUTH_FIX.md` — Auth remediation history
- `docs/REDIRECT_LOOP_FIX.md` — Redirect loop analysis
- `docs/QA_CHECKLIST.md` — QA verification checklist
- `docs/QA_MATRIX.md` — Full QA matrix

### Proof Packs
- `docs/PROOF_PACK_MASTER.md` — Master QA proof pack
- `docs/PROOF_PACK_TABS.md` — Full tabs scan proof
- `docs/TABS_ROOT_CAUSES.md` — Root cause analysis
- `docs/CONTINUE_STATE.md` — Current state snapshot
- `CHANGELOG.md` — Version history
