# Changelog

## Unreleased

### fix
- Unblocked Vercel `next build` when runtime session secret is injected after build phase.
- Fixed stale-cookie redirect loop (`/login` <-> `/overview`) by validating session cookie signature/expiry in `proxy` and clearing invalid cookies.
- Fixed signup/runtime schema drift by syncing Prisma schema during web build (`prisma db push`) and always refreshing the production sqlite `/tmp` fallback copy on cold start.
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
