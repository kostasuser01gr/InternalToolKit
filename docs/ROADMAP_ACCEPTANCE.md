# Roadmap Acceptance Criteria

## Per-Module Acceptance (Production-Grade)

### Phase 1 — Stability
- [ ] Zero 500s across all routes with missing env vars (actionable message instead)
- [ ] Middleware.ts for early auth rejection + request logging
- [ ] No "Something went wrong" without errorId visible
- [ ] Build passes without runtime DB access

### Phase 2 — Imports v2
- [ ] Upload XLSX/CSV/JSON/TXT → parse → preview with diff counts
- [ ] Template mapping profiles for Bookings and Vehicles
- [ ] Accept → transactional apply with audit trail
- [ ] Decline → no changes
- [ ] Rollback → reverses applied batch
- [ ] Idempotency: duplicate file hash rejected
- [ ] Bookings import creates draft shifts (not just fleet)

### Phase 3 — Fleet v2
- [ ] State machine enforces valid transitions
- [ ] SLA timers per stage + breach notifications
- [ ] QC checklist pass/fail with typed schema
- [ ] Incidents with severity + repair tracking
- [ ] Priority queue sorted by needByAt
- [ ] Saved views (Ready, Stuck, Needs QC, Blocked)

### Phase 4 — Washers
- [ ] Main dashboard: KPIs, queue, register, export, bulk edit
- [ ] PWA: no login UI, token-based auth, read-only fallback
- [ ] Quick plate loop with presets and next-car focus
- [ ] Offline queue with sync
- [ ] Share panel with QR + install instructions

### Phase 5 — Chat v2
- [ ] Channels/DMs/groups with roles
- [ ] Replies, pins, mentions, reactions
- [ ] Edit/delete (author + admin can delete any)
- [ ] Attachments + voice notes support
- [ ] Read receipts
- [ ] Message search
- [ ] Viber outbound mirror with retry + dead-letter

### Phase 6 — Feeds
- [ ] RSS source registry with admin management
- [ ] Cron scanning with rate limiting + ETag + dedupe
- [ ] Severity scoring with keyword matching
- [ ] Ops Inbox for high-severity items
- [ ] Internal retry + dead-letter for failed scans

### Phase 7 — Weather
- [ ] Browser geolocation → station fallback
- [ ] Open-Meteo cached fetch
- [ ] Stale badge on failure
- [ ] Widget on home/fleet/washers

### Phase 8 — Search
- [ ] Postgres FTS for messages/feeds/notes
- [ ] pg_trgm for plates/names
- [ ] RBAC-safe server endpoints
- [ ] Command palette typeahead

### Phase 9 — Shortcuts
- [ ] Per-user Quick Bar with role defaults
- [ ] Inline/bulk/undo in high-volume tables
- [ ] Keyboard navigation

### Phase 10 — Connections
- [ ] Env validation scripts
- [ ] Setup wizard for missing vars
- [ ] Vercel + Supabase + GH CLI verification
- [ ] Proof report documentation
