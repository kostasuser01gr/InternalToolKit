# Viber-like Chat System

## Overview
Enhanced chat with channels, DMs, replies, reactions, pins, and presence — modeled after Viber/Telegram UX.

## Features

### Channels
- **PUBLIC**: Visible to all workspace members (e.g., #ops-general, #washers-only)
- **PRIVATE**: Invite-only channels
- **DM**: Direct messages between two users
- **GROUP**: Multi-user group chats

### Channel Properties
- `slug`: Unique per workspace (e.g., "washers-only", "ops-general")
- `isReadOnly`: When true, only admins can post
- `isArchived`: Hidden from active list
- `description`: Channel purpose

### Messages
- Text content with markdown support
- Reply threads (`replyToId`)
- Reactions (emoji-based, one per user per emoji)
- Pins (`isPinned` flag)
- Edit history (`isEdited`, `editedAt`)
- Soft delete (`isDeleted`)
- Mentions (`mentionsJson`)

### Read Receipts
- Per-user, per-message tracking
- Policy-based: can be disabled per channel or workspace

### Default Channels
| Channel | Slug | Purpose |
|---------|------|---------|
| #ops-general | ops-general | Default staff channel |
| #washers-only | washers-only | Washer communications (kiosk + staff) |

## RBAC

### Channel Posting Policy
- Channel members with `admin` or `member` role can post
- Read-only channels: only `admin` role can post
- Kiosk devices post with kiosk identity (deviceId + stationId)

### Moderation
- Channel admins can delete messages
- Workspace admins can manage all channels
- Archive channels (soft delete)

## Server Actions
Located in `app/(app)/chat/channel-actions.ts`:
1. `createChannelAction` — Create new channel
2. `updateChannelAction` — Update channel settings
3. `joinChannelAction` — Join/leave channel
4. `sendChannelMessageAction` — Send message to channel
5. `reactToMessageAction` — Add/remove reaction
6. `pinMessageAction` — Toggle pin status

## Kiosk Chat Integration
- Kiosk devices chat via `/api/kiosk/chat` endpoint
- Messages posted to #washers-only with kiosk identity prefix
- Daily threads auto-created (one per day)
- Rate-limited: 30 messages per minute per device

## Environment Variables
No additional env vars required for core chat. See VIBER_BRIDGE.md for external integration.
