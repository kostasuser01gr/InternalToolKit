# InternalToolKit

Premium, cross-device internal tool template as a pnpm monorepo.

## Monorepo

```text
/
  apps/
    web/                 # Next.js App Router frontend
    api/                 # Cloudflare Worker API
  packages/
    shared/              # shared zod schemas/types/constants
  docs/
    architecture.md
    tokens.md
    scorecard.md
```

## Tech Stack

### Frontend (`apps/web`)

- Next.js App Router + TypeScript strict
- Tailwind CSS + shadcn-style + Radix primitives
- lucide-react icons
- framer-motion micro-interactions (reduced-motion aware)
- Recharts placeholders
- Prisma + SQLite (template local data layer)

### Backend (`apps/api`)

- Cloudflare Worker (TypeScript, ES modules)
- Native fetch router + proper CORS
- Shared request/response contracts from `@internal-toolkit/shared`

### Shared (`packages/shared`)

- zod schemas and types used by web + api

## Features Included

- Premium dark glass UI with neon purple active states
- Universal app shell:
  - Mobile: sticky header + bottom nav (5 items, center create action)
  - Tablet: icon side-rail
  - Desktop: sidebar + topbar
- Command palette (`Cmd/Ctrl+K`) + keyboard shortcuts
- Data module with table/field/record flows and CSV export
- Admin gate and role-safe actions
- PWA baseline (`manifest`, icons, safe-area handling, viewport-fit cover)

## API Routes (`apps/api`)

- `GET /health` -> `{ ok: true, version, timestamp }`
- `GET /v1/me` -> demo authenticated user
- `POST /v1/audit` -> append audit event (in-memory repository)
- `POST /v1/assistant/draft-automation` -> accepts `{ text }` (or `{ prompt }` for compatibility) and returns a draft automation JSON

## Environment Files

- Web example: `apps/web/.env.example`
- API example: `apps/api/.dev.vars.example`

Never commit real secrets. `.gitignore` covers `.env*` and `.dev.vars*` while allowing `*.example`.

Runtime validation:

- Web fails fast on startup when required env vars are invalid (`SESSION_SECRET`/`NEXTAUTH_SECRET`).
- API validates `CORS_ORIGIN` shape and returns a clear runtime error if malformed.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure web env:

```bash
cp apps/web/.env.example apps/web/.env.local
```

3. (Optional) Configure Worker local vars:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

4. Prepare local web DB:

```bash
pnpm --filter @internal-toolkit/web prisma:generate
pnpm --filter @internal-toolkit/web db:reset
```

5. Demo login credentials (dev only):

- Admin:
  - email: `admin@internal.local`
  - password: `Admin123!`
- Viewer:
  - email: `viewer@internal.local`
  - password: `Viewer123!`

## Development

Run web:

```bash
pnpm dev:web
```

Run API worker:

```bash
pnpm dev:api
```

Default local URLs:

- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787`

If using Playwright smoke tests, web test server runs on `http://127.0.0.1:4173`.

## Quality Gates

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:e2e
pnpm build
```

Playwright smoke coverage:

- Mobile: shell + bottom nav + no overflow
- Desktop: sidebar/topbar + navigation
- Data flow: create table -> add field -> add record -> export CSV
- Admin gate: viewer blocked, admin allowed

`pnpm test:e2e` automatically resets and seeds the local SQLite database before running tests.

## Deployment

## 1) Cloudflare Workers (Backend)

From repo root:

```bash
pnpm --filter @internal-toolkit/api dev
pnpm --filter @internal-toolkit/api deploy
```

Or directly in `apps/api`:

```bash
npx wrangler dev
npx wrangler deploy
```

Set secrets:

```bash
npx wrangler secret put <KEY>
```

Recommended variables:

- `APP_VERSION`
- `CORS_ORIGIN` (your frontend domain)

After deploy, note worker URL (for example `https://internaltoolkit-api.<subdomain>.workers.dev`).

## 2) Vercel (Frontend)

1. Import this GitHub repo in Vercel.
2. Set **Root Directory** to: `apps/web`
3. Set environment variable:
   - `NEXT_PUBLIC_API_URL=<your-worker-url>`
4. Deploy.

Vercel will deploy automatically on push by default.

## CI/CD

- CI workflow: `.github/workflows/ci.yml`
  - install, lint, typecheck, prisma reset, playwright smoke, build
- Worker deploy workflow: `.github/workflows/deploy-worker.yml`
  - deploys on push to `main`
  - requires secrets:
    - `CLOUDFLARE_API_TOKEN`
    - `CLOUDFLARE_ACCOUNT_ID`

## Extension Guide

### Add a new web page

1. Create `apps/web/app/(app)/<page>/page.tsx`
2. Register item in `apps/web/lib/constants/navigation.ts`
3. Add RBAC checks if needed in server actions/routes

### Add a new API route

1. Add handler in `apps/api/src/index.ts`
2. Define/extend zod schema in `packages/shared/src/index.ts`
3. Parse/validate input in worker and return typed envelope

### Add a new design token

1. Add token in `apps/web/styles/tokens.css`
2. Consume token in components/pages
3. Update `docs/tokens.md` contract if the token is part of public design system

### Add a new card/component type

1. Add component in `apps/web/components/kit`
2. Export from `apps/web/components/kit/index.ts`
3. Add state coverage on `/components` showroom

## Notes

- No real auth provider is required for the template baseline; web includes a secure cookie session gate and RBAC patterns ready for extension.
- Worker audit storage is in-memory by design for v1; code is structured around a repository interface so KV/D1 can replace it cleanly.

## Troubleshooting

- `Invalid environment configuration` on web startup:
  - `cp apps/web/.env.example apps/web/.env.local`
  - set `SESSION_SECRET` to at least 16 characters.
- CI badge red:
  - open `.github/workflows/ci.yml` run details in GitHub Actions to see failing step.
  - re-run locally with: `pnpm install && pnpm lint && pnpm typecheck && pnpm test:e2e && pnpm build`.
- Worker CORS error:
  - verify `CORS_ORIGIN` in `apps/api/.dev.vars` is a comma-separated list of valid `http(s)` origins.
