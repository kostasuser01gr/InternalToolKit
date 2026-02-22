# Viber Bridge — #washers-only Channel Mirror

> Feature Flag: `FEATURE_VIBER_BRIDGE=1` (default OFF)

## Overview

The Viber Bridge mirrors messages from the `#washers-only` internal channel to a Viber group, enabling external washers who prefer Viber to stay in the loop.

## Architecture

```
Internal Chat (#washers-only) ──→ Bridge Service ──→ Viber Bot API ──→ Viber Group
                                       ↑
                                  Rate Limiter
                                  Retry Queue
                                  Dead-letter Log
```

### Direction
- **Primary**: One-way (internal → Viber) — most reliable
- **Optional**: Two-way inbound (Viber → internal) via webhook — requires Viber Bot account and public webhook URL

## Configuration

| Env Var | Required | Description |
|---------|----------|-------------|
| `VIBER_BOT_TOKEN` | Yes | Viber Bot API token |
| `VIBER_GROUP_ID` | Yes | Target Viber group chat ID |
| `VIBER_WEBHOOK_URL` | For two-way | Public URL for inbound Viber messages |
| `FEATURE_VIBER_BRIDGE` | Yes | Set to `1` to enable |

## Outbound (Internal → Viber)

1. When a message is posted to `#washers-only`, a webhook/event fires
2. Bridge service formats the message (strips internal metadata, redacts sensitive info)
3. Sends via Viber Bot API `POST /pa/send_message`
4. Rate limited: max 20 messages/minute to Viber
5. On failure: retry up to 3 times with exponential backoff
6. After 3 failures: message goes to dead-letter queue + admin alert

## Inbound (Viber → Internal) — Optional

1. Viber sends webhook to `VIBER_WEBHOOK_URL`
2. Bridge validates webhook signature
3. Maps Viber user to internal washer identity (by phone or deviceId)
4. Posts message to `#washers-only` channel as the mapped user
5. Unknown users: message posted as "External Washer (unlinked)"

## Redaction

Before sending to Viber, the bridge redacts:
- Internal user IDs
- Database references
- API keys/tokens
- Internal URLs (replaced with "[internal link]")

## Admin View

Coordinators can see in Settings → Integrations → Viber Bridge:
- Bridge status (active/paused/error)
- Last 10 sent messages with delivery status
- Dead-letter queue (failed messages)
- Manual retry button for failed messages

## Limitations

1. Viber Bot API has rate limits (max ~500 messages/day for free bots)
2. Rich media (images, voice notes) requires Viber-specific formatting
3. Two-way bridge requires a public webhook URL (not available in all environments)
4. Viber group membership is managed in Viber, not in the internal app
5. Message edits/deletes in internal chat are NOT propagated to Viber (append-only)

## Implementation Status

- [x] Feature flag (`FEATURE_VIBER_BRIDGE`)
- [x] Schema: ChatChannel model supports `#washers-only`
- [x] Documentation (this file)
- [ ] Bridge service implementation (requires Viber Bot token)
- [ ] Webhook handler for inbound
- [ ] Admin UI in settings
- [ ] Rate limiter + dead-letter queue
