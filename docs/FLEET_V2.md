# Fleet V2

Fleet V2 builds on the foundation described in [FLEET_PIPELINE.md](./FLEET_PIPELINE.md) (state machine details, transition rules, and pipeline overview).

## State Machine

```
RETURNED → NEEDS_CLEANING → CLEANING → QC_PENDING → READY
                                              ↓
                                        OUT_OF_SERVICE
```

Any state can also transition to `OUT_OF_SERVICE` when a critical incident is raised.

See [FLEET_PIPELINE.md](./FLEET_PIPELINE.md) for full transition rules and guard conditions.

## SLA Timers

Each state has a configurable SLA target. Deadlines are computed via `computeSlaDeadline()` based on the transition timestamp and the SLA duration for that state.

When a vehicle breaches its SLA, an alert is dispatched through the notifications system so ops can intervene immediately.

## QC Signoff

When a vehicle reaches `QC_PENDING`:

- **Pass** — vehicle moves to `READY`.
- **Fail** — inspector selects one or more failure reasons; a **rework** task is created and the vehicle returns to `NEEDS_CLEANING` or `OUT_OF_SERVICE` depending on severity.

## Incidents

Incidents capture damage, breakdowns, or other issues.

| Field | Description |
|-------|-------------|
| `severity` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `status` | Tracks lifecycle (open → in-progress → resolved) |
| `photos` | Attached images for evidence |
| `repairEta` | Estimated repair completion |
| `repairCost` | Estimated or actual cost |

Critical incidents automatically move the vehicle to `OUT_OF_SERVICE`.

## Vehicle Events Timeline

Every meaningful action on a vehicle is recorded as a `VehicleEvent`:

- State transitions
- QC results
- Incidents opened / resolved
- Mileage / fuel updates
- Notes added

This provides a full audit trail visible in the vehicle detail view.

## Bulk Status Changes

The **BulkFleetBar** component allows ops to select multiple vehicles and apply a status change in one action.

- **Maximum:** 50 vehicles per bulk operation
- **Undo stack:** bulk changes can be undone via the undo action in the bar

## Inline Editing

The **FleetInlineField** component supports click-to-edit for:

- Mileage
- Fuel level
- Notes

Changes are saved on blur / Enter and recorded as vehicle events.

## Saved Views

Pre-configured filters for common fleet queries:

| View | Description |
|------|-------------|
| **Ready** | Vehicles in `READY` state, available for dispatch |
| **Stuck** | Vehicles that have breached their SLA in any state |
| **Blockers** | Vehicles in `OUT_OF_SERVICE` or with open `HIGH` / `CRITICAL` incidents |

## Keys & Docs Tracking

Physical keys and documents (registration, insurance) are tracked through the incidents and events system:

- Key handovers are logged as vehicle events.
- Missing documents are raised as incidents for resolution.

## Ops OS Additions (2026-02-23)

### New Pipeline State: FleetPipelineState
Extended the vehicle pipeline with a dedicated `FleetPipelineState` enum:
- RETURNED, NEEDS_CLEANING, CLEANING, QC_PENDING, READY, RENTED, BLOCKED, MAINTENANCE, OUT_OF_SERVICE
- New functions: `isValidPipelineTransition()`, `allowedPipelineTransitions()`

### New Models
- **VehicleQcLog**: QC inspection records with checklist, pass/fail, inspector
- **VehicleBlocker**: Blocker tracking (no_key, damage, low_fuel, docs_missing, waiting_parts)
- **KeyHandoverLog**: Key location and handover tracking

### New Vehicle Fields
- `pipelineState`: FleetPipelineState enum
- `slaBreachedAt`: When SLA was breached
- `needByAt`: Priority from bookings import
- `keyLocation`: Current key location

### QC Checklist
8-item template: exterior_clean, interior_clean, windows_clear, vacuum_done, no_odor, fuel_ok, docs_present, key_present
