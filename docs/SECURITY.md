# Security Baseline

## Web Security

### CSP (Nonce Strategy)
- Implemented in `apps/web/proxy.ts`.
- Per-request nonce is generated and injected into response headers.
- `Content-Security-Policy` includes nonce-based script/style allowances and strict baseline directives.

### Security Headers
Set in proxy responses:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Request-Id`

### Session Cookie Hardening
Defined in `apps/web/lib/auth/cookie-adapter.ts` and `apps/web/lib/auth/constants.ts`:
- `HttpOnly: true`
- `SameSite: lax`
- `Secure: true` in production (`NODE_ENV=production` or `SESSION_COOKIE_SECURE=1`)
- Explicit set/delete in route handlers/server-side adapter only

### CSRF Mitigation
- `isSameOriginRequest` validates unsafe requests using `Origin`/`Referer` against host.
- Cross-origin unsafe requests are blocked with `403`.

### Abuse Control (Auth)
- Lightweight in-memory rate limiter for login endpoints:
  - `POST /api/session/login`
  - `POST /api/session/login-form`
- Returns `429` (JSON endpoint) or redirect error (form endpoint) after threshold.

## API Worker Security

### CORS Policy
- Strict allowlist from `ALLOWED_ORIGINS`.
- Wildcard `*` is intentionally rejected.
- `OPTIONS` preflight supported.
- `Vary: Origin` enabled.

### API Security Headers
Applied to API responses in `apps/api/src/index.ts`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (HTTPS requests only)
- `X-Request-Id`

### Request Correlation and Logging
- Request ID generated (or accepted from incoming `x-request-id`).
- Structured log record for each request includes method, path, status, duration.

## Audit Logging Policy

### Append-Only Pattern
- Web app writes to `AuditLog` model via `appendAuditLog()`.
- No mutation path is exposed for existing audit rows in app flows.
- Audit entries are created for auth/session and privileged operations.

### Future Hardening
- Consider immutable storage/WORM export pipeline for long-term compliance.
