# System Scan Baseline

Date: 2026-03-04  
Repo: `kostasuser01gr/InternalToolKit`  
Branch: `main`  
Commit: `dac4cf0b6dffbfebc554c3fd02655653edbcd837`

## Reported Symptoms

- Multiple modules intermittently show `Something went wrong`.
- CI instability in mobile E2E navigation and data assertions.
- Health endpoint behavior drift when environment is degraded.
- CI policy drift: critical diagnostic steps currently not enforced as hard gates.

## Latest Failed GitHub Actions Runs

1. CI run `22675376319` (2026-03-04)
   - Job: `E2E smoke tests`
   - Proven signature:
     - Mobile command palette navigation did not leave `/analytics`.
     - `expect(page).toHaveURL(...)` timed out at 30s with repeated unexpected URL `http://127.0.0.1:4173/analytics`.
     - Follow-on timeout: `page.waitForURL` exceeded 30s.
2. CI run `22675126153` (2026-03-04)
   - Job: `E2E smoke tests`
   - Proven signature:
     - Early `@internal-toolkit/web test:e2e` recursive run failure.

## Filesystem Route Inventory

Source: `apps/web/app/**/page.tsx`

### App routes

- `/activity`
- `/admin`
- `/analytics`
- `/assistant`
- `/automations`
- `/calendar`
- `/chat`
- `/components`
- `/controls`
- `/costs`
- `/dashboard`
- `/data`
- `/feeds`
- `/fleet`
- `/home`
- `/imports`
- `/notifications`
- `/ops-inbox`
- `/overview`
- `/procurement`
- `/reports`
- `/settings`
- `/shifts`
- `/washers`
- `/work-orders`

### Auth routes

- `/accept-invite`
- `/forgot-password`
- `/login`
- `/reset-password`
- `/signup`

### Kiosk routes

- `/washers/app` (from `apps/web/app/(kiosk)/washers/app/page.tsx`)

### Root route

- `/`

## Module Coverage Targets

- Core app: home/overview/dashboard/chat/assistant/shifts/fleet/washers/calendar/feeds/imports/data/reports/activity/notifications/ops-inbox/controls/components/admin/settings.
- New business modules: work-orders/procurement/costs.
- Kiosk surface: washers app route.

## Known Production Risk Items To Validate

- `/api/health` must return JSON and remain non-redirecting in degraded states.
- `/login` must always serve HTML (`Content-Type: text/html; charset=utf-8`).
- Request/error correlation IDs must be surfaced in UI and logs.
- No dead primary actions across Desktop/Mobile/Tablet.
