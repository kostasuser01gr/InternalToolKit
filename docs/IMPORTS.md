# Imports Module

## Overview

Upload XLSX, CSV, JSON, or TXT files to import bookings, vehicles, staff, or other data into the system. AI analyzes file structure and proposes column mappings. Human review (accept/decline) is required before any changes are applied.

## Workflow

```
Upload → Analyzing → Preview → Accept/Decline
                                    ↓         ↓
                               Applying    Declined
                                    ↓
                                Applied ← → Rollback
```

### Status Flow
| Status | Description |
|---|---|
| UPLOADING | File being received |
| ANALYZING | AI/system analyzing file structure |
| PREVIEW | Mapping proposed, awaiting human review |
| ACCEPTED | Approved by admin |
| DECLINED | Rejected, no changes applied |
| APPLYING | Changes being written to database |
| APPLIED | Successfully imported |
| ROLLED_BACK | Import reverted |
| FAILED | Import failed during apply |

## Security

- **RBAC**: Only ADMIN or higher can create/accept/decline/rollback imports
- **Idempotency**: Files are deduplicated by SHA-256 hash per workspace
- **Audit**: All actions logged with actor, timestamp, and metadata
- **File size**: Capped at ~375KB stored content (base64 in previewJson)

## API

### Upload Endpoint
`POST /api/imports/upload` (multipart/form-data)
- Fields: `workspaceId`, `importType`, `file`
- Returns: `{ batchId, status, fileName }`
- 409 if file hash already exists in non-terminal status

### Server Actions
- `createImportBatchAction` — Create batch from form data
- `updateMappingAction` — Update column mapping JSON
- `acceptImportAction` — Apply import (PREVIEW → APPLYING → APPLIED)
- `declineImportAction` — Decline import
- `rollbackImportAction` — Rollback applied import

## Mapping Templates (`lib/imports/templates.ts`)
- **BOOKINGS_TEMPLATE**: Europcar/Goldcar 77-column bookings export
  - Maps columns like agreement #, confirmation #, vehicle model, dates, driver info
  - Includes date parsing transforms

## Diff Engine (`lib/imports/diff-engine.ts`)
- Compares parsed import data against existing DB records
- Generates diff proposals: creates, updates, archives, skips
- Match keys configurable per template

## UI (`/imports`)
- Upload card with drag-and-drop file input
- Import type selector (bookings, vehicles, staff, other)
- Recent imports list with status badges
- Accept/Decline buttons for PREVIEW batches
- Rollback button for APPLIED batches

## Environment Variables
No additional env vars needed. Uses existing DATABASE_URL for DB access.

## Ops OS Additions (2026-02-23)

### Apply Engine
- `applyFleetDiff()`: Processes preview diffs, creates/updates vehicles, stores change-sets
- Handles create, update actions with full error tracking per row

### Rollback Engine
- `rollbackBatch()`: Reverses all change-sets for a batch
- Created vehicles → archived (OUT_OF_SERVICE)
- Updated vehicles → reverted to pre-import state

### ImportChangeSet Model
New Prisma model for tracking individual changes within an import batch:
- `batchId`, `entityType`, `entityId`, `action` (create/update/archive)
- `beforeJson` (snapshot before), `afterJson` (snapshot after)
