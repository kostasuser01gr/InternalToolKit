# Washers Dashboard

## Overview
The Washers module provides real-time operational management for vehicle washing operations.

## KPI Dashboard
Located at the top of `/washers`, showing today's metrics:
- **Today Tasks**: Total tasks created today
- **Completed**: Tasks with DONE status
- **Pending**: Tasks with TODO or IN_PROGRESS status
- **Issues**: Tasks with BLOCKED status
- **Avg Turnaround**: Mean time from creation to completion (minutes)
- **Top Washers**: Leaderboard of washers by task count

## Daily Register
Excel-like table with:
- Date picker (defaults to today)
- Columns: Time, Plate, Washer, Status, Ext/Int/Vac, Notes
- Bulk edit: Select multiple rows → change status
- 15-second undo for bulk operations
- CSV export via Export button

## Share Washer App Panel
At `/washers`, the Share panel shows:
- **Shareable link**: `/washers/app?kiosk=***&station=<ID>`
- **Install instructions** for iOS (Safari → Add to Home Screen), Android (Chrome → Install), Desktop (Chrome → Install icon)
- **Kiosk token status**: Shows whether KIOSK_TOKEN env var is configured

## QR Code
QR code generation can be added by including any QR library. The share link is displayed as copyable text.

## Exports
- CSV export of daily register data via `/api/washers/export`
- Includes all fields: created time, plate, washer, status, services, notes

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| KIOSK_TOKEN | Yes | Token for kiosk write access |
| KIOSK_STATION_ID | No | Default station identifier (defaults to "default") |
