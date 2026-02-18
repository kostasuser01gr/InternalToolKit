# InternalToolKit Architecture

## Monorepo Layout

```text
/
  apps/
    web/      # Next.js App Router frontend
    api/      # Cloudflare Worker backend
  packages/
    shared/   # zod schemas, types, constants shared by web+api
```

## Route Groups (Web)

- `apps/web/app/(auth)`
  - `/login`
- `apps/web/app/(app)`
  - `/dashboard`
  - `/analytics`
  - `/controls`
  - `/data`
  - `/automations`
  - `/assistant`
  - `/chat`
  - `/settings`
  - `/admin`

`(app)` routes are protected by `apps/web/proxy.ts` and server-side session checks in `apps/web/lib/auth/*`.

## UI Architecture

- `components/ui`: base primitives (shadcn-style + Radix wrappers)
- `components/kit`: reusable product components (cards, controls, data table)
- `components/layout`: app shell (bottom nav, side rail, sidebar, topbar, page header)
- `styles/tokens.css`: semantic design tokens and scales
- `styles/globals.css`: global utilities, safe-area handling, viewport hardening

## Responsive Shell Strategy

- Mobile: sticky header + 5-item bottom navigation with centered primary action
- Tablet: icon side-rail
- Desktop: full sidebar + topbar with search/actions/profile

All shell variants share the same route source of truth via navigation constants.

## Data Flow

### Frontend

1. UI interaction -> server action or route handler
2. zod validation (in `lib/validators`)
3. persistence (Prisma + SQLite in web app for template demo)
4. status/audit update surfaced in UI

### Backend Worker

1. request enters `apps/api/src/index.ts`
2. CORS + method routing
3. payload validation via `@internal-toolkit/shared` schemas
4. response serialization with stable JSON envelopes

## Shared Package Contract

`packages/shared` exports:

- health response schema/types
- audit event input/output schema/types
- assistant draft request/response schema/types
- shared constants

Both `apps/web` and `apps/api` import these contracts to prevent drift.

## Provider Adapters

### Auth Adapter (Web)

- `lib/auth/adapter.ts`: adapter interface
- `lib/auth/cookie-adapter.ts`: secure cookie implementation

### Assistant Adapter (Web)

- `lib/assistant/provider.ts`: provider interface
- mock provider default, OpenAI stub support with env checks

This keeps infrastructure swappable without UI refactors.

## Security Layers

- session cookie flags: HttpOnly, SameSite, Secure (prod/flag)
- proxy route protection for app pages
- server-side RBAC checks for admin/workspace actions
- CSP and security headers from `apps/web/proxy.ts`
- audit logging for meaningful user/system actions

## Error and Offline Strategy

- app-level route-group error boundary in `(app)/error.tsx`
- loading boundary in `(app)/loading.tsx`
- offline banner for network state feedback
- toast feedback for mutation outcomes
