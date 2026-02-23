# Prioritized Backlog — InternalToolKit

## P0 — Critical (Blocks Production Usage)

### P0-1: Supabase Database Unreachable
**Status:** ⚠️ DECISION REQUIRED  
**Root Cause:** DATABASE_URL/DIRECT_URL point to a Supabase instance not reachable from Vercel  
**Impact:** All 15+ feature modules show empty data (pages protected by withDbFallback) or crash on form submissions (server actions unprotected)  
**Options:**
1. Re-enable Supabase connectivity (update DATABASE_URL to a reachable instance)
2. Migrate all feature modules to Convex (major effort)

**Acceptance Criteria:**
- [ ] Feature module queries return real data (not empty arrays)
- [ ] Form submissions (create/update/delete) succeed without errors

### P0-2: Health Sub-Endpoints
**Status:** 🔧 Ready to implement  
**What:** Add `/api/health/db` and `/api/health/auth` for fast debugging  
**Acceptance Criteria:**
- [ ] `/api/health/db` returns 200 if DB reachable, 500 with missing env names if not
- [ ] `/api/health/auth` validates cookie/session flow
- [ ] Tests exist for both endpoints

---

## P1 — High (Degrades UX, Users Hit Errors on Actions)

### P1-1: Protect Server Actions from DB Unavailability
**Status:** 🔧 Ready to implement  
**What:** 24+ server action files crash on form submission when Prisma is unreachable  
**Files:** fleet/actions.ts, shifts/actions.ts, washers/actions.ts, data/actions.ts, admin/actions.ts, notifications/actions.ts, settings/actions.ts, imports/actions.ts, ops-inbox/actions.ts, search/actions.ts, inventory/actions.ts, automations/actions.ts, automations2/actions.ts, incidents/actions.ts, assistant/actions.ts, stations/actions.ts, compliance/actions.ts, chat/channel-actions.ts, workforce/actions.ts, fleet/inline-actions.ts, shifts/shift-inline-actions.ts, shifts/bulk-actions.ts, settings/station-actions.ts, settings/role-shortcuts-actions.ts  
**Pattern:** Wrap each action in try/catch, return `{ error: "Database temporarily unavailable" }` via redirect with error searchParam  
**Acceptance Criteria:**
- [ ] No server action crashes with unhandled P1001
- [ ] User sees actionable error message ("Database temporarily unavailable")
- [ ] Lint + typecheck + tests pass

### P1-2: Data Export Route Error Handling
**Status:** 🔧 Ready to implement  
**What:** `(app)/data/export/route.ts` has raw Prisma queries without error handling  
**Acceptance Criteria:**
- [ ] Export route returns 503 with message when DB unreachable
- [ ] No unhandled crash

---

## P2 — Medium (Nice to Have, Not Blocking)

### P2-1: Missing Feature Env Vars
**Status:** ℹ️ Informational  
**What:** Optional env vars for specific features not set in Vercel  
**Vars:** KIOSK_TOKEN, KIOSK_STATION_ID, OPENROUTER_API_KEY, VIBER_* (5 vars), NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_URL  
**Impact:** Kiosk app, AI assistant cloud mode, Viber bridge — all disabled  
**Acceptance Criteria:**
- [ ] Each feature has clear error message when its env var is missing
- [ ] Setting the var enables the feature without code changes

### P2-2: Convex Production Deployment
**Status:** ℹ️ Planned  
**What:** Convex backend running on dev deployment (`dev:amiable-chicken-236`), should be promoted to production  
**Acceptance Criteria:**
- [ ] `npx convex deploy --prod` runs successfully
- [ ] CONVEX_DEPLOYMENT updated to production deployment name in Vercel

### P2-3: Search Page Route
**Status:** ℹ️ Enhancement  
**What:** `/search` returns 404 — search is currently only a server action, not a standalone page  
**Acceptance Criteria:**
- [ ] `/search` renders a search UI with results (or redirect to chat with search)

### P2-4: Cron Job Verification
**Status:** ℹ️ Needs testing  
**What:** 4 cron jobs configured in vercel.json (`/api/cron/daily`, `/api/cron/feeds`, `/api/cron/weather`, `/api/cron/housekeeping`) — all require Prisma for data operations  
**Impact:** Crons will fail silently when Prisma unreachable  
**Acceptance Criteria:**
- [ ] Cron endpoints return meaningful error when DB unreachable
- [ ] Cron logs visible in Vercel

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| P0 | 2 | 1 decision required, 1 ready |
| P1 | 2 | Ready to implement |
| P2 | 4 | Planned / informational |
