# AuthFix Report

## Symptom
Users could create an account successfully, but login could fail afterward in hosted runtime.

## Reproduction

### 1) Local dev auth flow (control case)
- Command: `pnpm -w install`
- Command: `pnpm -C apps/web dev` (Turbopack in this environment hit a workspace-root resolution issue, so auth repro used webpack dev mode)
- Command: `pnpm -C apps/web exec next dev --webpack --hostname 127.0.0.1 --port 4173`
- Signup and login requests (`/api/session/signup-form`, `/api/session/login-form`) returned `303`, and server logs reported:
  - `auth.signup_success`
  - `auth.login_success` (pin + password)

### 2) Production-mode cold-start repro (failure case)
- Command: `pnpm -C apps/web build`
- Command: `SESSION_SECRET=... DATABASE_URL='file:./prisma/runtime.sqlite' pnpm -C apps/web start --hostname 127.0.0.1 --port 4173`
- Signup/login before restart:
  - `POST /api/session/signup` -> `200 {"ok":true,...}`
  - `POST /api/session/login` (pin) -> `200 {"ok":true,...}`
  - `POST /api/session/login` (password) -> `200 {"ok":true,...}`
- DB check before restart:
  - `apps/web/prisma/runtime.sqlite` user count for new email: `0`
  - `/tmp/internal-toolkit-runtime.db` user count for new email: `1`
- Restarted server with same env and retried login:
  - `POST /api/session/login` (pin) -> `401 {"ok":false,"message":"Invalid credentials."}`
  - `POST /api/session/login` (password) -> `401 {"ok":false,"message":"Invalid credentials."}`

## Root Cause
`apps/web/lib/db.ts` copied file-based production databases to `/tmp/internal-toolkit-runtime.db`.  
In hosted/serverless cold starts, this causes auth writes from one process instance not to be visible in another cold-started instance.

This created the observed sequence:
1. Signup writes user/session to ephemeral `/tmp` DB.
2. Cold start copies bundled sqlite again (without that user).
3. Login lookup cannot find the user and returns invalid credentials.

## Fix Summary

### Code changes
- `apps/web/lib/db.ts`
  - Removed production sqlite copy-to-`/tmp` bootstrap logic.
  - Prisma now uses `DATABASE_URL` directly from validated env.
- `apps/web/lib/env.ts`
  - Added fail-fast validation for hosted production:
    - reject `DATABASE_URL` values starting with `file:`.
    - keep existing requirement that `DATABASE_URL` must be present.
- `apps/web/.env.example`
  - Updated guidance: hosted production must use a persistent, non-file database URL.

### Regression coverage
- `apps/web/tests/unit/auth-signin.test.ts`
  - Added focused auth test for:
    - normalized user lookup (`email`, `loginName`)
    - bcrypt hash comparison path in login.
- `apps/web/tests/smoke.spec.ts`
  - Extended signup/login smoke flow to verify protected session persistence on protected routes after each login path.

## Vercel Environment Variables (required)
- `SESSION_SECRET` (>=16 chars)
- `DATABASE_URL` (persistent non-file URL; do not use `file:...`)
- Optional:
  - `NEXTAUTH_SECRET` (alternative secret source)
  - `NEXT_PUBLIC_API_URL`
