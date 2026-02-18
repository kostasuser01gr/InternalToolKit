# Troubleshooting

## Install or Build Issues

### `pnpm install` warns about ignored build scripts
This repository intentionally uses pnpm's default script restrictions.
- Warning is expected unless you explicitly approve build scripts.
- Core install/build still works without manual approval in this template.

### Next.js build fails with session-secret error
- Ensure hosted runtime has `SESSION_SECRET` (or `NEXTAUTH_SECRET`) set.
- Local build can use safe fallback secret for fresh-clone developer experience.

### Signup fails with `Unable to create account right now`
- Check runtime logs for sqlite open errors (for example `Unable to open connection to local database ./dev.db`).
- Set `DATABASE_URL` in Vercel for persistent writes.
- Without `DATABASE_URL`, the app uses `/tmp/internal-toolkit-runtime.db` fallback (ephemeral demo storage).

### Playwright fails by running unit test files
- Playwright is scoped to `*.spec.ts` in `apps/web/playwright.config.ts`.
- Unit tests are executed separately via Vitest (`pnpm test:unit`).

## API/CORS Issues

### `Origin not allowed`
- Update `ALLOWED_ORIGINS` with your real web domains (comma-separated).
- Example:
  - `http://127.0.0.1:3000`
  - `https://<your-vercel-domain>`

### Worker deploy skipped in GitHub Actions
- Add repository secret `CLOUDFLARE_API_TOKEN`.
- Optional: add `CLOUDFLARE_ACCOUNT_ID` if your setup requires it.

## Auth/Security Issues

### Browser shows `ERR_TOO_MANY_REDIRECTS` on login/signup
- This was caused by stale/invalid `uit_session` cookies from older deploys.
- Current build validates cookie signatures in proxy and auto-clears invalid cookies.
- If your browser still loops, clear site cookies once and refresh.

### Login blocked with rate limit message
- Wait for the limiter window to reset (default 60s).
- In local development, restart server to clear in-memory limiter state.
- Automated browser tests can hit this limit if running many concurrent auth attempts from one IP; keep default suite settings.

### Cannot sign in with old email/password form usage
- Primary UI login is `loginName + 4-digit PIN`.
- API routes still support email/password for compatibility.
- If migrating old accounts, ensure `loginName` and `pinHash` are populated.

### Shift creation fails with invalid datetime
- Shift forms submit `datetime-local`; server action normalizes to ISO before validation.
- If calling API/server actions manually, use ISO datetime values (with timezone) for `startsAt` / `endsAt`.

### Cross-origin request blocked on auth endpoints
- Ensure browser requests come from same origin as web app host.
- For manual curl testing, include matching `Origin` and `Host` headers.

## Local Runtime Checks

### Web app
```bash
pnpm -C apps/web dev
```
Open `http://127.0.0.1:3000`.

### API worker
```bash
pnpm -C apps/api dev
```
Test `http://127.0.0.1:8787/health`.
