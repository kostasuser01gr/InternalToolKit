# Diagnostic Report — InternalToolKit Production

## 1. Deployment Baseline

| Item | Value |
|------|-------|
| **Production URL** | `https://internal-tool-kit-web.vercel.app` |
| **Project** | `kostasuser01gr/internal-tool-kit-web` |
| **Latest commit** | `8196e1f` |
| **Latest deploy** | `dpl_7cywfc9v2YG66nAeck3wavwyEaTU` |
| **CI status** | ✅ All 5 latest runs passing |
| **Health endpoint** | ✅ `{"ok":true,"db":"convex"}` |
| **Backend** | Convex (auth, users, workspaces, audit) + Prisma/Supabase (feature data — unreachable) |

---

## 2. Route Status Matrix

### Working Routes (200 or correct redirect)

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | 200 | Login page renders correctly |
| `/api/health` | 200 | Health check passes |
| `/api/search` | 200 | Search API operational |
| `/api/weather` | 200 | Weather API operational |
| `/` | 307→`/login` | Correct unauth redirect |
| `/overview`, `/home`, `/chat`, `/fleet`, `/shifts`, etc. | 307→`/login` | Correct auth gating |
| `POST /api/session/login-form` | 303 | Login flow works (returns credentials error for bad input) |
| Cron routes | 401 | Correctly require CRON_SECRET |

### Non-existent Routes (expected 404)

| Route | Status | Notes |
|-------|--------|-------|
| `/search` | 404 | No page.tsx — search is actions-only (server action in chat) |
| `/weather` | 404 | No page route — weather is API-only (`/api/weather`, `/api/cron/weather`) |

### Routes That Crash After Authentication (P0)

These pages render via SSR and query Prisma. Since Supabase is unreachable from Vercel, they crash with `PrismaClientKnownRequestError P1001` unless protected by `withDbFallback`. 

**All SSR pages now have `withDbFallback` protection** as of commit `8196e1f`. Pages degrade gracefully (show empty data) instead of crashing.

**However: 24+ server actions (form submissions) still lack database error handling.** User interactions like "Create shift", "Add vehicle", "Import CSV" will crash if Prisma is unreachable.

---

## 3. Root Cause Analysis

### Category A: Supabase/Prisma Unreachable (FUNDAMENTAL)

**Status:** DATABASE_URL and DIRECT_URL are set in Vercel, but point to a Supabase instance that is unreachable from Vercel's network. All Prisma queries fail with `P1001: Can't reach database server`.

**Impact:** Every feature module that queries Prisma (fleet, shifts, washers, data, reports, imports, feeds, notifications, activity, calendar, analytics, automations, assistant, admin, ops-inbox, dashboard) returns empty data on page load and crashes on form submissions.

**Root cause:** The app was partially migrated from Prisma/Supabase to Convex. Auth, users, workspaces, and audit are on Convex (working). All feature data (vehicles, shifts, tables, records, feed items, notifications, etc.) remains on Prisma (unreachable).

### Category B: Server Actions Without Error Handling (P1)

24+ server action files import `db` from `@/lib/db` and perform Prisma operations without any error handling. When a user submits a form (create shift, add vehicle, etc.), the action crashes with an unhandled P1001 error.

**Affected files:** fleet/actions.ts, shifts/actions.ts, washers/actions.ts, data/actions.ts, admin/actions.ts, notifications/actions.ts, settings/actions.ts, imports/actions.ts, calendar/actions.ts, and more.

### Category C: Missing Health Sub-Endpoints (P2)

Only `/api/health` exists. Missing:
- `/api/health/db` — database connectivity check
- `/api/health/auth` — auth flow check

### Category D: Missing Feature Routes (Informational)

- `/search` — No page route (search is a server action in chat, not a standalone page)
- `/weather` — No page route (API-only at `/api/weather`)
- These are not bugs; the user-facing features don't need standalone pages.

---

## 4. Environment Variables

### Present in Vercel (Production + Preview)

| Env Var | Status |
|---------|--------|
| `DATABASE_URL` | ✅ Set (but Supabase unreachable) |
| `DIRECT_URL` | ✅ Set (but Supabase unreachable) |
| `SESSION_SECRET` | ✅ Set |
| `CRON_SECRET` | ✅ Set |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ Set |
| `CONVEX_DEPLOYMENT` | ✅ Set |

### Not Set in Vercel (Optional / Feature-Specific)

| Env Var | Required For | Impact |
|---------|-------------|--------|
| `OPENROUTER_API_KEY` | AI assistant (cloud mode) | Assistant uses mock mode |
| `KIOSK_TOKEN` | Washers kiosk app | Kiosk auth fails |
| `KIOSK_STATION_ID` | Washers kiosk app | Kiosk station lookup fails |
| `VIBER_*` (5 vars) | Viber bridge integration | Viber integration disabled |
| `NEXT_PUBLIC_APP_URL` | AI assistant router | Falls back to request URL |
| `NEXT_PUBLIC_API_URL` | API client | Falls back to localhost |

---

## 5. Architecture Assessment

### Current State (Partial Migration)

```
┌─────────────────────────────────┐
│          Next.js App            │
│                                 │
│  Auth ──────> Convex ✅         │
│  Users ─────> Convex ✅         │
│  Workspaces > Convex ✅         │
│  Audit ─────> Convex ✅         │
│                                 │
│  Fleet ─────> Prisma ❌ P1001   │
│  Shifts ────> Prisma ❌ P1001   │
│  Washers ───> Prisma ❌ P1001   │
│  Data/Tables > Prisma ❌ P1001  │
│  Feeds ─────> Prisma ❌ P1001   │
│  Imports ───> Prisma ❌ P1001   │
│  Chat ──────> Prisma ❌ P1001   │
│  Notifications > Prisma ❌ P1001│
│  Calendar ──> Prisma ❌ P1001   │
│  Analytics ─> Prisma ❌ P1001   │
│  Reports ───> Prisma ❌ P1001   │
│  ... (15+ modules)              │
└─────────────────────────────────┘
```

### Decision Required

Two paths forward:
1. **Fix Supabase connectivity** — Make DATABASE_URL/DIRECT_URL point to a reachable Supabase instance. All feature modules would immediately start working.
2. **Complete Convex migration** — Migrate all 15+ feature modules from Prisma to Convex. Major effort but eliminates dual-database complexity.

---

## 6. What's Already Fixed (This Session)

| Commit | Fix |
|--------|-----|
| `534dfd1` | Removed all `as any` casts in auth/rbac — proper Convex Id types |
| `4e96756` | Auth throttle fail-open when Prisma unreachable |
| `1dcfd3c` | Regression tests for throttle fail-open |
| `a40cd56` | `isDatabaseUnavailableError` in 22 SSR page files |
| `8196e1f` | `withDbFallback` helper + remaining 6 SSR pages + layout crash protection |

**Result:** No more HTTP 500s on page load. All pages degrade gracefully to empty data.
