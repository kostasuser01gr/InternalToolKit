# Changelog

## Unreleased

### fix
- Unblocked Vercel `next build` when runtime session secret is injected after build phase.
- Hardened API CORS to strict allowlist mode (wildcard rejected).
- Added API security headers and request-id correlation.
- Added auth endpoint abuse controls (in-memory login rate limiting).
- Strengthened same-origin checks for unsafe web API routes.

### feat
- Added unit test layer (Vitest) for shared schema contracts and security helpers.
- Added CSP nonce strategy and web security headers via `proxy` convention.
- Added minimal service worker registration and offline shell fallback.

### chore
- Expanded CI workflow with unit test gate.
- Added deployment, security, troubleshooting, and ADR documentation.
- Added audit/release tracking in `docs/AUDIT.md`.
