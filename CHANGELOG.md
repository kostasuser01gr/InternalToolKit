# Changelog

## Unreleased

### feat — High ROI Upgrades

#### Phase 1 — Washer Kiosk: Quick Plate + Presets + Next-car Mode
- Added Quick Plate autofocus input with live match preview and Enter-to-save (Next-car mode).
- Added service presets: Basic, Full, Express, VIP with configurable checkbox mappings.
- Added one-hand action buttons (Start/Done/Issue) for active tasks in the queue.
- Improved status labels: "Created" vs "Updated (deduped)" for clear feedback.

#### Phase 2 — Offline Queue + Idempotency
- Enhanced offline queue to include preset/service data in queued tasks.
- Existing idempotency and dedupe logic preserved and tested.

#### Phase 3 — Fleet Turnaround Pipeline + QC + SLA Alerts
- Added fleet state machine: RETURNED → NEEDS_CLEANING → CLEANING → QC → READY (+ BLOCKED/MAINTENANCE).
- Added QC signoff role enforcement (ADMIN/EDITOR only) with fail reason codes.
- Added SLA breach detection with configurable per-state time limits.
- Added `slaMinutesRemaining()` helper for countdown displays.

#### Phase 4 — Shifts: Publish/Lock + Swap Requests + Constraints
- Added schedule lifecycle: DRAFT → REVIEW → PUBLISHED with lock enforcement.
- Added swap request approval role checks (ADMIN/EDITOR only).
- Added shift overlap detection for same-user conflicts.
- Added overtime violation detection with configurable daily hour limits.

#### Phase 5 — Ops Chat: Entity Threads + Mentions + Moderation
- Added entity-linked thread schema (vehicle, washer_task, shift, shift_request).
- Added mention user schema for @user notifications.
- Added moderation action schema: delete, mute_author, lock_thread.

#### Phase 6 — KPI / Dashboards
- Added KPI calculation utilities: task counts, average turnaround, fleet readiness rate.
- Added data quality score (0–100) for missing fields.
- Added daily register CSV export generator.
- Added staffing coverage by hour calculation.

#### Phase 7 — Governance Safety + Feature Flags
- Added 7 new feature flags: kioskPresets, offlineQueue, fleetQcStep, fleetSlaAlerts, shiftPublishLock, chatEntityThreads, coordinatorDashboard.
- Extended RBAC matrix with `analytics` resource (read + export permissions).
- Added 85 new unit tests across fleet pipeline, shifts workflow, KPIs, and governance.

### docs
- Added `docs/WASHERS_KIOSK.md` — Quick Plate, presets, offline queue, dedupe documentation.
- Added `docs/FLEET_PIPELINE.md` — Fleet lifecycle states, QC step, SLA alerts.
- Added `docs/SHIFTS_WORKFLOW.md` — Publish/lock workflow, swap requests, constraints.
- Added `docs/OPS_CHAT.md` — Entity-linked threads, mentions, moderation.
- Added `docs/ANALYTICS_KPIS.md` — KPI definitions and coordinator dashboard guide.

### fix
- Hardened `/chat` against unified-chat schema drift by degrading optional panels and mapping schema-not-ready errors to actionable remediation guidance.
- Migrated web runtime DB path from sqlite/libsql to Postgres (Supabase-compatible) and removed file-based sqlite production dependency.
- Added hosted env enforcement for `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET`, with explicit Supabase/Vercel remediation guidance.
- Replaced sqlite migration/reset fallbacks with Postgres-safe Prisma workflows (`migrate deploy`, `migrate reset`) and updated CI to run against Postgres service.
- Incident (auth/runtime): fixed hosted `signup -> login` failures and login 500s caused by file-based sqlite fallback divergence across serverless cold starts.
- Root cause: production runtime could write auth state to ephemeral sqlite while subsequent requests read a different cold-started copy.
- Fix: removed production `/tmp` sqlite bootstrap, enforced hosted fail-fast env validation (`DATABASE_URL` required and `file:` rejected), and documented durable DB requirements for Vercel/Cloudflare.
- Prevention: added auth regression tests for normalized lookup, wrong PIN rejection, leading-zero PIN support, and signup/login session persistence smoke flow.
- Unblocked Vercel `next build` when runtime session secret is injected after build phase.
- Fixed stale-cookie redirect loop (`/login` <-> `/overview`) by validating session cookie signature/expiry in `proxy` and clearing invalid cookies.
- Fixed signup/runtime schema drift by enforcing checked-in Prisma migrations (`prisma migrate deploy`) and removing ephemeral production sqlite fallback behavior.
- Hardened API CORS to strict allowlist mode (wildcard rejected).
- Added API security headers and request-id correlation.
- Added auth endpoint abuse controls (in-memory login rate limiting).
- Strengthened same-origin checks for unsafe web API routes.
- Fixed signup/login UX by introducing primary `loginName + PIN` flow and preserving API email/password compatibility.
- Fixed shift form datetime validation by normalizing `datetime-local` input to ISO server-side.
- Stabilized smoke suite selectors and auth throttling behavior for parallel browser runs.

### feat
- Added unit test layer (Vitest) for shared schema contracts and security helpers.
- Added CSP nonce strategy and web security headers via `proxy` convention.
- Added minimal service worker registration and offline shell fallback.
- Added first-class `shifts`, `fleet`, `washers`, and `calendar` modules with RBAC-protected server actions.
- Added shift board drag/drop move API and CSV export/import support.
- Added voice-input component (feature-flagged) for washer notes.
- Added desktop smoke tests for chat, shift planner, and fleet flows.

### chore
- Expanded CI workflow with unit test gate.
- Added deployment, security, troubleshooting, and ADR documentation.
- Added audit/release tracking in `docs/AUDIT.md`.
