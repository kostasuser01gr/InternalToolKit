# Shifts Workflow — Publish/Lock, Swap Requests & Constraints

## Overview

The shifts module supports operational scheduling with a publication workflow, swap requests, and constraint detection.

## Schedule Lifecycle

```
DRAFT → REVIEW → PUBLISHED (locked)
  ↑        ↓
  └────────┘ (send back)
```

- **DRAFT**: Freely editable by coordinators
- **REVIEW**: Under review, can be sent back to DRAFT or promoted to PUBLISHED
- **PUBLISHED**: Locked — edits require coordinator override

### Functions
- `isScheduleEditable(state)` — returns true only for DRAFT
- `isScheduleLocked(state)` — returns true for PUBLISHED
- `isValidScheduleTransition(current, next)` — validates transitions
- Feature flag: `NEXT_PUBLIC_FEATURE_SHIFT_PUBLISH_LOCK`

## Swap Request Flow

1. Employee proposes a swap via `ShiftRequest` (type: SWAP)
2. Supervisor/coordinator (ADMIN or EDITOR) approves or rejects
3. On approval: schedule updates + audit logged
4. `canApproveSwap(role)` enforces role-based approval

## Constraints & Conflict Detection

### Overlap Detection
`detectOverlaps(shifts)` finds shifts for the same user that overlap in time. Returns pairs of conflicting shift IDs.

### Overtime Violations
`detectOvertimeViolations(shifts, maxHoursPerDay)` finds users exceeding daily hour limits (default: 10h).

## Verification Checklist

1. Create shifts in DRAFT state → verify editable
2. Transition DRAFT → REVIEW → PUBLISHED → verify locked
3. Attempt PUBLISHED → DRAFT → verify rejection
4. Create overlapping shifts for same user → verify overlap warning
5. Create >10h of shifts for same user on same day → verify overtime warning
6. Submit swap request as EMPLOYEE → verify PENDING status
7. Approve swap as ADMIN → verify schedule update + audit log
