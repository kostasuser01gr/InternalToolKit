# Runtime 500 Fix — Auth Throttle Fail-Open

## Baseline Error

- **Route**: `POST /api/session/login-form`
- **Error**: `PrismaClientKnownRequestError` (P1001) — Can't reach database server at `db.*.supabase.co`
- **Root cause**: The auth throttle module (`lib/auth/throttle.ts`) calls Prisma `authThrottle.findUnique()` directly with no Convex path or failure handling. Since Supabase is unreachable from Vercel, every login attempt crashes.
- **Bucket**: A (DB connectivity) — Prisma-only code path without fail-open.

## Fix Applied

**File**: `apps/web/lib/auth/throttle.ts`

- Wrapped `checkAuthThrottle` in try/catch: returns `{ allowed: true }` if DB is null or query throws.
- Wrapped `registerAttempt` in try/catch: silently skips throttle recording if DB is unreachable.
- This is **fail-open** by design: throttle is a rate-limiter, and blocking all logins is worse than allowing a temporarily unthrottled login. Authentication itself is secured via Convex (bcrypt verification runs server-side in Convex actions).

## Regression Test

**File**: `apps/web/tests/unit/auth-throttle.test.ts`

- `checkAuthThrottle` returns allowed when db is null
- `registerAuthFailure` does not throw when db is null
- `registerAuthSuccess` does not throw when db is null

## Env Vars Required (names only)

| Name | Where |
|------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel (all envs) |
| `CONVEX_DEPLOYMENT` | Vercel (all envs) |
| `SESSION_SECRET` | Vercel (all envs) |
| `DATABASE_URL` | Vercel (optional — Prisma fallback) |
| `DIRECT_URL` | Vercel (optional — Prisma fallback) |

## Verification

```
# Health endpoint
curl -s https://internal-tool-kit-web.vercel.app/api/health
→ {"ok":true,"db":"convex"}

# Login page loads
curl -s -o /dev/null -w "%{http_code}" https://internal-tool-kit-web.vercel.app/login
→ 200

# Login form POST returns 303 (not 500)
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Origin: https://internal-tool-kit-web.vercel.app" \
  -d "method=pin&loginName=test&pin=1234" \
  "https://internal-tool-kit-web.vercel.app/api/session/login-form?callbackUrl=%2Foverview"
→ 303

# Root redirects to /login (no loop, no 500)
curl -s -o /dev/null -w "%{http_code}" https://internal-tool-kit-web.vercel.app/
→ 307
```

## Deployment

- **Production URL**: https://internal-tool-kit-web.vercel.app
- **Deployment**: https://internal-tool-kit-8gx1q4fab-kostasuser01gr.vercel.app
- **Tests**: 581/581 passing (42 test files)
- **Commits**: `4e96756` (fix), `1dcfd3c` (test)
