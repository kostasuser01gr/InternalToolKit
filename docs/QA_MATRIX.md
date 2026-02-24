# QA Test Matrix

> Auto-generated route inventory for InternalToolKit.
> Each route lists auth requirement, primary user actions, and expected result.

## App Routes (require auth)

| Route | Auth? | Primary Actions | Expected Result |
|---|---|---|---|
| `/home` | yes | View dashboard cards, navigate to modules | Page renders, links work |
| `/overview` | yes | View dashboard (alias for /home) | Page renders |
| `/dashboard` | yes | View system status, quick actions | Page renders |
| `/data` | yes | Create table, add field, add record, export CSV, paginate, switch views | Toast confirmations, CSV download |
| `/automations` | yes | View automations list, run automation, filter | List renders, run triggers toast |
| `/assistant` | yes | Open assistant, interact with AI | Page renders, responses appear |
| `/chat` | yes | Create thread, send message, switch thread | Toast confirmations, message appears |
| `/shifts` | yes | Create shift, view board, move shift | Toast confirmation, board updates |
| `/fleet` | yes | Add vehicle, update vehicle, open details | Toast confirmations, list updates |
| `/washers` | yes | Create wash task, mark done, view register | Toast confirmations, status changes |
| `/calendar` | yes | View calendar, navigate dates | Calendar renders, date nav works |
| `/analytics` | yes | View charts, filter data | Charts render |
| `/controls` | yes | Toggle controls, save preferences | State changes persist |
| `/activity` | yes | View activity log, filter | List renders |
| `/reports` | yes | View reports, export | PDF/export triggers |
| `/components` | yes | Browse component showroom | Components render |
| `/notifications` | yes | View notifications, mark read | Status changes |
| `/settings` | yes | Open sections, save preferences | Toast on save |
| `/admin` | yes (admin) | View admin panel (viewer blocked) | RBAC gate works |
| `/imports` | yes | Upload file, preview, accept/decline | File processes, status updates |
| `/feeds` | yes | View feeds, filter, open feed | List renders |
| `/ops-inbox` | yes | View ops requests, approve/decline | Status changes |

## Kiosk Routes

| Route | Auth? | Primary Actions | Expected Result |
|---|---|---|---|
| `/washers/app` | kiosk-token | View tasks, complete task | Task status updates |

## Auth Routes (no auth required)

| Route | Auth? | Primary Actions | Expected Result |
|---|---|---|---|
| `/login` | no | Enter credentials, submit | Redirect to /home or /overview |
| `/signup` | no | Fill form, create account | Redirect to /home |
| `/forgot-password` | no | Enter email, request reset | Toast confirmation |
| `/reset-password` | no | Enter new password, submit | Redirect to /login |
| `/accept-invite` | no | Accept workspace invite | Redirect to app |

## API Endpoints (contract tests, no a11y)

| Endpoint | Method | Expected Status | Expected Shape |
|---|---|---|---|
| `/api/health` | GET | 200 | `{ ok: boolean, db: string }` |
| `/api/health/db` | GET | 200 | `{ ok: boolean, backends: object }` |
| `/api/version` | GET | 200 | `{ version: string }` |
| `/api/search` | GET | 200/401 | JSON array or auth error |
| `/api/weather` | GET | 200 | JSON weather data |
| `/api/activity` | GET | 200/401 | JSON array |
| `/api/integrations/status` | GET | 200 | `{ integrations: object }` |

## Navigation Components

| Component | Viewport | Routes Exposed |
|---|---|---|
| Sidebar (`sidebar.tsx`) | Desktop (xl+) | All 16 sidebarNavItems |
| SideRail (`side-rail.tsx`) | Tablet (md–xl) | All 16 sidebarNavItems (icon-only) |
| BottomNav (`bottom-nav.tsx`) | Mobile (<md) | Home, Shifts, Create (action), Chat, Calendar |
| TopBar | Desktop | Search, notifications, user menu |

## Device Test Projects

| Project | Device | Key Nav Element |
|---|---|---|
| Desktop | Desktop Chrome 1440×900 | Sidebar + TopBar |
| Tablet | iPad gen 7 | SideRail + MobileHeader |
| Mobile | iPhone 14 | BottomNav + MobileHeader |
