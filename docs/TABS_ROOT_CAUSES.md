# Tabs Root Causes — Full Scan Analysis

## Scan Date: Latest run

## Summary

Full diagnostic scan across 3 viewports (Desktop, Tablet, Mobile) covering 27 routes.
All routes now PASS — 0 failures, 0 real dead actions.

## Root Causes Found & Fixed

### 1. WeatherWidgetGeo Hydration Mismatch (Category H: Flaky timing)

**Route:** `/overview`
**Evidence:** Console error: "Hydration failed because the server rendered HTML didn't match the client"
**Root Cause:** `useState(getCachedData)` initializer reads `sessionStorage` during SSR — returns `null` on server but cached weather data on client.
**Fix:** Initialize state with `null`, defer `sessionStorage` read to `useEffect` after mount.
**File:** `apps/web/components/widgets/weather-widget-geo.tsx`

### 2. Shifts Date Formatting Hydration Mismatch (Category H: Flaky timing)

**Route:** `/shifts`
**Evidence:** Console error: Hydration text content mismatch between server/client date strings
**Root Cause:** `toLocaleDateString()` without explicit locale produces different formats on server (system locale) vs client (browser locale).
**Fix:** Replaced with `format(date, "dd/MM/yyyy HH:mm")` from `date-fns` for deterministic output.
**File:** `apps/web/app/(app)/shifts/bulk-shift-bar.tsx`

### 3. Admin Page False Positive 500 Detection (Category H: Flaky timing)

**Route:** `/admin`
**Evidence:** Test regex `/500/i` matched "5000" in USAGE_LIMITS table on admin page
**Root Cause:** Over-broad crash detection regex in full-scan test
**Fix:** Split into `Application error|Internal Server Error` check + word-boundary `\b500\b` for standalone 500.
**File:** `apps/web/tests/diagnostics/full-scan.spec.ts`

## Click Audit Results

### True Dead Actions: 2 (auth forms)
- `/signup` → "Create account": HTML5 form validation blocks submission without data entry. Not a bug.
- `/forgot-password` → "Send reset token": Same — form validation prevents empty submission.

### Click Blocked: 26-33 (varies by viewport)
All are `SubmitButton` components using React's `useFormStatus()` hook. Buttons are disabled during hydration or require form data to be actionable. Verified working via dedicated smoke tests.

## Categories Referenced

| Category | Description | Count |
|----------|-------------|-------|
| A | Missing "use client" | 0 |
| B | Overlay/z-index blocking | 0 |
| C | Button type problem | 0 |
| D | Middleware/auth loop | 0 |
| E | Backend failure/500 | 0 |
| F | RBAC dead click | 0 |
| G | State/cache not updating | 0 |
| H | Flaky timing/hydration | 3 (all fixed) |
