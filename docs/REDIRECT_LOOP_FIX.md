# Redirect Loop Fix — ERR_TOO_MANY_REDIRECTS

> Fixed: 2026-02-23 | Commit: `9572973`

## Root Cause

The production redirect loop (`ERR_TOO_MANY_REDIRECTS`) was caused by a **disagreement between Edge and Server session validation**.

### The Loop

```
/login → proxy (Edge): "cookie looks valid" → redirect to /overview
  → /overview → server: "session invalid in DB" → redirect to /login
    → /login → proxy: "cookie looks valid" → redirect to /overview
      → LOOP
```

### Why It Happened

1. **proxy.ts** (Edge Runtime) validates the session cookie using HMAC-SHA256. If `SESSION_SECRET` is unavailable in Edge (too short, missing, or not injected), it returned `true` for any structurally valid, non-expired cookie — a **fail-open** fallback.

2. **cookie-adapter.ts** (Server Runtime) validates the same cookie using Node.js `crypto` + a database lookup. It correctly identifies revoked/invalid sessions.

3. When these disagreed (proxy says valid, server says invalid), the user bounced endlessly between `/login` and `/overview`.

## Fix (Two Layers of Defense)

### 1. proxy.ts — Tri-State Cookie Validation

`isValidSessionCookie()` now returns `"valid" | "invalid" | "unverified"`:

- **`"valid"`**: Cookie is cryptographically verified with HMAC ✅
- **`"invalid"`**: Cookie is malformed, expired, or signature mismatch ❌
- **`"unverified"`**: Cookie looks OK structurally but SECRET is unavailable; can't verify ⚠️

Behavior changes:
- **Auth-path redirect** (`/login` → `/overview`): Only fires when cookie is `"valid"` (cryptographically verified). `"unverified"` cookies are passed to server.
- **App-route redirect** (`/overview` → `/login`): Skipped when cookie is `"unverified"` — let the server decide.

### 2. Server-Side Cookie Cleanup

`(app)/layout.tsx` and `app/page.tsx` now **clear the stale session cookie** before redirecting to `/login`. This breaks any loop after at most one iteration, regardless of proxy behavior.

## How to Verify

```bash
# Must terminate in ≤ 2 redirects (not loop)
curl -I -L --max-redirs 5 https://internal-tool-kit-web.vercel.app/

# /login must return 200, not redirect
curl -I https://internal-tool-kit-web.vercel.app/login

# Protected routes redirect to /login once
curl -I https://internal-tool-kit-web.vercel.app/overview
```

## How to Prevent Future Loops

1. **Never redirect from auth pages based on unverified session state.** Only cryptographically verified cookies should trigger "already logged in" redirects.
2. **Always clear the cookie when server-side auth fails.** This ensures the proxy and server agree on session state.
3. **Run the regression tests:** `pnpm test:unit` — 13 tests in `redirect-loop.test.ts` cover all redirect invariants.

## Files Changed

| File | Change |
|------|--------|
| `proxy.ts` | `isValidSessionCookie` → tri-state return; conservative auth-path redirect |
| `app/(app)/layout.tsx` | Clear cookie before redirect to `/login` |
| `app/page.tsx` | Clear cookie before redirect to `/login` |
| `tests/unit/redirect-loop.test.ts` | 13 regression tests |
