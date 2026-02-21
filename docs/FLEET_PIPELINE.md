# Fleet Turnaround Pipeline — States, QC & SLA Alerts

## Overview

The fleet turnaround pipeline converts vehicle management into an operational workflow with defined lifecycle states, quality control, and SLA monitoring.

## Vehicle Lifecycle States

```
RETURNED → NEEDS_CLEANING → CLEANING → QC → READY
                                  ↓
                           BLOCKED / MAINTENANCE
```

### State Transitions

| From | Allowed To |
|------|-----------|
| RETURNED | NEEDS_CLEANING, BLOCKED, MAINTENANCE |
| NEEDS_CLEANING | CLEANING, BLOCKED, MAINTENANCE |
| CLEANING | QC, BLOCKED, MAINTENANCE |
| QC | READY, NEEDS_CLEANING (fail → reclean), BLOCKED, MAINTENANCE |
| READY | RETURNED, NEEDS_CLEANING, BLOCKED, MAINTENANCE |
| BLOCKED | NEEDS_CLEANING, RETURNED, MAINTENANCE |
| MAINTENANCE | NEEDS_CLEANING, RETURNED, BLOCKED |

Invalid transitions are rejected by `isValidTransition()` in `lib/fleet-pipeline.ts`.

## QC Step

- Supervisor signoff required (ADMIN or EDITOR roles)
- QC fail reason codes: SPOTS_ON_BODY, INTERIOR_DIRTY, WINDOWS_STREAKED, VACUUM_INCOMPLETE, ODOR, OTHER
- Failed QC sends vehicle back to NEEDS_CLEANING
- Feature flag: `NEXT_PUBLIC_FEATURE_FLEET_QC_STEP`

## SLA Timers / Alerts

Default SLA limits per state:

| State | Max Minutes |
|-------|------------|
| NEEDS_CLEANING | 30 |
| CLEANING | 45 |
| QC | 15 |

- `isSlaBreached()` checks if vehicle has exceeded its SLA
- `slaMinutesRemaining()` returns minutes until breach
- SLA configs can be overridden per deployment
- Feature flag: `NEXT_PUBLIC_FEATURE_FLEET_SLA_ALERTS`

## Vehicle Timeline

All state changes, washer updates, QC signoffs, and incidents are logged as `VehicleEvent` records with audit trail.

## Verification Checklist

1. Create a vehicle → verify initial status
2. Transition through RETURNED → NEEDS_CLEANING → CLEANING → QC → READY
3. Attempt invalid transition (e.g., RETURNED → READY) → verify rejection
4. As WASHER role, attempt QC signoff → verify rejection
5. As ADMIN, perform QC signoff → verify success
6. Leave vehicle in CLEANING > 45 min → verify SLA breach alert
