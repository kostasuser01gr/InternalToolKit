# QA Checklist — Washers + Chat Upgrades

## Automated Tests (305 passing)
- [x] KPI computation (total, done, pending, blocked, avg turnaround)
- [x] Top washers leaderboard
- [x] Kiosk token validation (empty, mismatch, valid, env not set)
- [x] Idempotency key generation (unique, UUID format)
- [x] Device ID persistence
- [x] Theme validation (known themes, fallback, link override)
- [x] CSV export (header, comma escaping)
- [x] Viber bridge PII redaction (email, phone, tokens, normal text)
- [x] Viber bridge status (disabled, structure)
- [x] Channel slug validation

## Manual Verification

### Washers Dashboard (`/washers`)
- [ ] KPI cards display correct values for today
- [ ] Top washers shows names with task counts
- [ ] Share panel shows correct link format
- [ ] Install instructions visible for iOS/Android/Desktop
- [ ] Kiosk token status indicator correct
- [ ] CSV export downloads file
- [ ] Daily register shows tasks for selected date
- [ ] Bulk edit works with undo

### Washer Companion App (`/washers/app`)
- [ ] Opens without login screen
- [ ] Read-only banner when no kiosk token
- [ ] Quick Plate input: type plate → Enter → task created
- [ ] Service presets apply correctly (Basic/Full/Express/VIP)
- [ ] Next-car mode: auto-refocus after submit
- [ ] History tab shows all device tasks
- [ ] Chat tab: load messages, send message
- [ ] Settings tab: theme switch persists
- [ ] Settings tab: device info displayed
- [ ] Clear history works
- [ ] Voice input (when NEXT_PUBLIC_FEATURE_VOICE_INPUT=1)
- [ ] Offline mode: tasks queue locally
- [ ] PWA installable on iOS/Android/Desktop

### Chat (`/chat`)
- [ ] Channel sidebar visible (when viberChat enabled)
- [ ] Channel filtering works
- [ ] Thread creation works
- [ ] Message sending works
- [ ] Reply/pin features work
- [ ] #washers-only channel auto-created on kiosk use

### Viber Bridge (`/api/viber`)
- [ ] Status endpoint returns bridge status
- [ ] Bridge disabled by default (FEATURE_VIBER_BRIDGE not set)
- [ ] When enabled: messages mirror to Viber group
- [ ] PII redacted before forwarding
- [ ] Dead-letter queue captures failures
- [ ] Retry endpoint processes dead letters

### Security
- [ ] No secrets in git
- [ ] Kiosk token validated server-side
- [ ] Rate limiting enforced per device
- [ ] Read-only mode for invalid tokens
- [ ] Cross-origin requests logged
- [ ] PII redacted in Viber bridge

## CI Pipeline
- [x] Unit tests pass (305/305)
- [x] Lint clean (0 warnings)
- [x] TypeScript strict mode passes
- [x] Next.js build succeeds
- [x] Vercel production deployment succeeds
- [x] Health endpoint responds
- [x] Viber bridge status endpoint responds

## Test Commands
```bash
pnpm --filter @internal-toolkit/web test:unit    # 305 tests
pnpm --filter @internal-toolkit/web lint         # 0 warnings
pnpm -w typecheck                                # strict mode
pnpm --filter @internal-toolkit/web build        # production build
curl https://internal-tool-kit-web.vercel.app/api/health
curl https://internal-tool-kit-web.vercel.app/api/viber
```
