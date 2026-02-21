# Analytics & KPIs — Coordinator Dashboard Definitions

## Overview

The coordinator dashboard provides real-time operational metrics via KPI cards and exportable data.

## KPI Definitions

### Wash Tasks
| Metric | Definition | Function |
|--------|-----------|----------|
| Tasks Created | Count of wash tasks created today | `countTasksByStatus()` |
| Tasks Completed | Count of tasks with DONE status today | `countTasksByStatus()` |
| Avg Turnaround | Mean time from task creation to DONE (minutes) | `avgTurnaroundMinutes()` |

### Fleet
| Metric | Definition | Function |
|--------|-----------|----------|
| Fleet Readiness | % of vehicles in READY status | `fleetReadinessRate()` |
| SLA Breaches | Count of vehicles exceeding state SLA limits | `isSlaBreached()` per vehicle |

### Data Quality
| Metric | Definition | Function |
|--------|-----------|----------|
| Data Quality Score | 0–100 score based on missing fields | `dataQualityScore()` |

### Staffing
| Metric | Definition | Function |
|--------|-----------|----------|
| Coverage by Hour | Number of assigned employees per hour slot | `staffingCoverageByHour()` |

## Daily Register CSV Export

`dailyRegisterCsv()` generates a CSV with columns:
- TaskID, Plate, Status, Exterior, Interior, Vacuum, CreatedAt

Feature flag: `NEXT_PUBLIC_FEATURE_COORDINATOR_DASHBOARD`

## Verification Checklist

1. Open analytics dashboard → verify KPI cards load
2. With seeded data → verify correct counts and percentages
3. With empty data → verify dashboard handles gracefully (no crashes)
4. Export daily register CSV → verify file downloads with correct format
