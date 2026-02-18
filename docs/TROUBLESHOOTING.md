# Troubleshooting

## Install or Build Issues

### `pnpm install` warns about ignored build scripts
This repository intentionally uses pnpm's default script restrictions.
- Warning is expected unless you explicitly approve build scripts.
- Core install/build still works without manual approval in this template.

### Next.js build fails with session-secret error
- Ensure hosted runtime has `SESSION_SECRET` (or `NEXTAUTH_SECRET`) set.
- Local build can use safe fallback secret for fresh-clone developer experience.

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

### Login blocked with rate limit message
- Wait for the limiter window to reset (default 60s).
- In local development, restart server to clear in-memory limiter state.

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
