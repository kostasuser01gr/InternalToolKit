# Ops Chat — Entity-linked Threads, Mentions & Moderation

## Overview

The ops chat module enhances team communication by linking conversations to operational entities and providing moderation controls.

## Entity-linked Threads

Chat threads can be attached to operational entities:
- **Vehicle**: Discuss a specific vehicle's status or issues
- **Washer Task**: Coordinate on a cleaning task
- **Shift**: Communicate about shift assignments
- **Shift Request**: Discuss swap/time-off requests

Schema: `createEntityThreadSchema` validates `entityType` and `entityId`.
Feature flag: `NEXT_PUBLIC_FEATURE_CHAT_ENTITY_THREADS`

## Mentions

- `@user` syntax triggers notification to mentioned user
- Schema: `mentionUserSchema` validates `mentionedUserId`
- Notifications created via the existing Notification model

## Moderation Controls

Role-based moderation actions (ADMIN/EDITOR only):
- **Delete**: Remove a message
- **Mute Author**: Prevent a user from posting in a thread
- **Lock Thread**: Prevent further messages in a thread

Schema: `moderateMessageSchema` validates action types.

## Retention Policy

- Messages are retained indefinitely by default
- Export foundation available via existing CSV export mechanisms
- Thread-level export for compliance/audit needs

## Verification Checklist

1. Create entity-linked thread for a vehicle → verify entity reference
2. Send message with @mention → verify notification created
3. As ADMIN, delete a message → verify removal
4. As ADMIN, lock a thread → verify no new messages allowed
5. As EMPLOYEE, attempt moderation → verify rejection
