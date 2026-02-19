# Changelog

## Unreleased

### fix
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
