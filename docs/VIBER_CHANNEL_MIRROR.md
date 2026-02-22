# Viber Channel Mirror

## Overview
The Viber Channel Mirror bridges internal chat channels to Viber for external visibility. Internal chat remains the canonical source — Viber receives a one-way mirror of selected channels.

## Architecture
- **Primary**: Viber Channel Post API (`/pa/post`) for public channel announcements
- **Fallback**: Viber Bot API (`/pa/send_message`) for group delivery
- Automatic fallback: if Channel Post fails, falls back to Bot API

## Mirrored Channels
Default: `#washers-only`. Configurable via `VIBER_MIRRORED_CHANNELS` env var (comma-separated).

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `FEATURE_VIBER_BRIDGE` | Yes | Set to `1` to enable |
| `VIBER_CHANNEL_AUTH_TOKEN` | Recommended | Token for Channel Post API |
| `VIBER_BOT_TOKEN` | Fallback | Token for Bot API |
| `VIBER_TARGET_GROUP_ID` | If using Bot API | Viber group/community ID |
| `VIBER_MIRRORED_CHANNELS` | Optional | Comma-separated channel slugs (default: `washers-only`) |
| `VIBER_BRIDGE_MODE` | Optional | `one-way` (default) or `two-way` |

## Setup Steps
1. Create a Viber Channel at [developers.viber.com](https://developers.viber.com)
2. Get the Channel Auth Token from your Viber admin panel
3. Set `VIBER_CHANNEL_AUTH_TOKEN` in Vercel Environment Variables
4. Set `FEATURE_VIBER_BRIDGE=1`
5. Optionally set `VIBER_MIRRORED_CHANNELS=washers-only,ops-general`
6. Deploy and verify via Settings → Integrations

## Safety Features
- **PII Redaction**: Emails, phone numbers, and long tokens are redacted before forwarding
- **Rate Limiting**: 20 messages/minute per channel
- **Dead-Letter Queue**: Failed messages are stored (max 100) and retried automatically during daily cron
- **Retry Logic**: Up to 5 attempts per failed message
- **No inbound by default**: One-way mirror only; two-way requires explicit opt-in

## Admin Status
Visit Settings → Integrations to see:
- Bridge readiness status
- Messages sent count
- Dead letter count
- Last success timestamp
- API configuration status

## API Endpoints
- `GET /api/viber` — Bridge status
- `POST /api/viber` with `{ "action": "retry" }` — Retry dead letters

## Limitations
- Viber Channel Post API may have rate limits depending on your channel tier
- Channel Post API doesn't support rich formatting (text only)
- Dead-letter queue is in-memory (resets on cold start)
