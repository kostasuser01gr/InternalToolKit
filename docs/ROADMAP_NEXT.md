# Ops OS Roadmap — Acceptance Criteria

## Imports
- [ ] Upload XLSX/CSV/JSON/TXT
- [ ] AI-assisted mapping with saved profiles
- [ ] Preview diff (create/update/archive counts)
- [ ] Manual edit grid before accept
- [ ] Accept applies transactionally
- [ ] Decline applies nothing
- [ ] Idempotency via file hash
- [ ] Rollback via stored change-set
- [ ] Audit trail (who uploaded, accepted, what changed)

## Fleet v2
- [ ] State machine: Returned → Needs Cleaning → Cleaning → QC → Ready (+ Blocked/Maintenance)
- [ ] SLA timers per stage + breach alerts
- [ ] QC checklist with pass/fail + rework tracking
- [ ] Blockers system (No key, Damage, Low fuel, Docs missing)
- [ ] Vehicle timeline with actor/timestamp
- [ ] Incidents: intake form + severity + repair ticket
- [ ] Keys/docs/accessories tracking
- [ ] Priority queue from bookings import
- [ ] Saved views (Ready, Stuck >30m, Blocked, Needs QC)
- [ ] Bulk actions + inline edits + undo

## Washers
- [ ] Main dashboard KPIs (created/completed/pending, avg turnaround, SLA, rework)
- [ ] Queue with filters + daily register grid
- [ ] Bulk edit + undo + export CSV
- [ ] History per washer/day/week
- [ ] Share Washer App panel (copy link, QR, kiosk token controls)
- [ ] External app: NO login screens, kiosk token auth
- [ ] Quick plate loop + presets + next-car focus
- [ ] Optional voice input behind feature flag
- [ ] History view + date picker
- [ ] Offline queue (pending/synced/failed)
- [ ] Idempotency + dedupe
- [ ] Theme switching (Quantum/Dark/Light/High-contrast)

## Chat
- [ ] Channels/DMs/groups + roles
- [ ] Replies/quote, pins, mentions, reactions
- [ ] Edit/delete for everyone
- [ ] Attachments: photo/video/file + voice notes
- [ ] Read receipts + presence
- [ ] Moderation: delete/mute/lock + retention
- [ ] Message + attachment search
- [ ] Default channels: #ops-general, #washers-only
- [ ] Washer app posts via kiosk identity
- [ ] Viber mirror (one-way to channel)

## Feeds
- [ ] FeedSource registry (RSS/official URLs)
- [ ] Scheduled polling via cron
- [ ] ETag/If-Modified-Since + dedupe
- [ ] Relevance scoring + severity
- [ ] UI: Feeds page + tool drawer
- [ ] Actions: Pin to chat, Send to channel, Ack/Resolve
- [ ] Ops Inbox integration for high severity

## Weather
- [ ] Browser geolocation → station fallback
- [ ] Open-Meteo fetch + caching TTL
- [ ] UI widget on home + fleet/washers header
- [ ] Never crash (graceful fallback)

## Search
- [ ] Postgres FTS for messages/feeds/notes
- [ ] pg_trgm for plates/names partial matching
- [ ] Global search with RBAC filtering
- [ ] Command palette with keyboard nav

## Shortcuts
- [ ] Per-user Quick Bar
- [ ] Per-role recommended shortcuts
- [ ] Quick actions panel
- [ ] Inline edit + bulk edit + undo + optimistic UI
- [ ] Virtualization and prefetch
