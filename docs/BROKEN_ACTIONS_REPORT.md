# Broken Actions — Root Cause Analysis & Fix Report

## Problem Statement

Multiple buttons/actions across the app appeared non-functional: no visual feedback on click, server action errors silently swallowed, optimistic UI stuck after failures.

## Root Causes Identified

### Category F: No Form Submission Feedback (46 buttons)

**Evidence**: Zero usage of `useFormStatus()` across the entire codebase. All 46 `<PrimaryButton type="submit">` elements inside server-action forms provided no pending/loading state. Users clicked buttons and saw no response until the redirect completed (or timed out on DB error).

**Fix**: Created `SubmitButton` component (uses `useFormStatus()`) showing "Saving…" + disabled state during submission. Replaced all 46 instances across 11 pages.

### Category H: Unhandled Server Action Errors (10 client components)

**Evidence**: Client components calling server actions via `startTransition(async () => { await action(...) })` without `try/catch`. If the action threw (DB unreachable, validation error), the error was unhandled: optimistic state stuck, no error message shown, button appeared dead.

**Affected components**:
| Component | File | Issue |
|-----------|------|-------|
| TaskQueueTable | washers/task-queue-table.tsx | No try/catch around updateWasherTaskAction |
| FeedItemsTable | feeds/feed-items-table.tsx | No try/catch around pinFeedItemAction, sendFeedToChatAction |
| FeedSourceKeywords | feeds/feed-source-keywords.tsx | No try/catch around updateFeedSourceKeywordsAction |
| DailyRegisterClient | washers/daily-register-client.tsx | No try/catch around bulkUpdateWasherTasksAction, undoWasherTasksAction |
| BulkFleetBar | fleet/bulk-fleet-bar.tsx | No try/catch around bulkUpdateVehiclesAction |
| BulkShiftBar | shifts/bulk-shift-bar.tsx | No try/catch around bulkUpdateShiftsAction |
| NotificationsList | notifications/notifications-list.tsx | No try/catch around markNotificationReadAction |
| AckFeedButton | ops-inbox/ops-inbox-actions-ui.tsx | No try/finally around ackFeedItemAction (setPending stuck) |
| DismissNotificationButton | ops-inbox/ops-inbox-actions-ui.tsx | No try/finally around dismissNotificationAction |
| ResolveIncidentButton | ops-inbox/ops-inbox-actions-ui.tsx | No try/finally around resolveIncidentAction |
| CreateIncidentForm | ops-inbox/ops-inbox-actions-ui.tsx | No try/finally around createIncidentAction |

**Fix**: Added try/catch blocks that revert optimistic state on error and show error messages via existing message state. Added try/finally to ops-inbox forms so `setPending(false)` always runs.

### Category B: Missing Pending State on Inline Action Buttons (5 buttons)

**Evidence**: Naked `<button type="submit">` elements in imports, feeds, and shifts pages — no pending feedback, no disabled state.

**Fix**: Created `FormSubmitButton` component (uses `useFormStatus()`) and replaced all 5 naked submit buttons.

## Files Changed

### New Components
- `components/kit/submit-button.tsx` — PrimaryButton + useFormStatus pending state
- `components/kit/form-submit-button.tsx` — Lightweight native button + useFormStatus

### Pages Updated (SubmitButton replacement)
- `app/(app)/admin/page.tsx`
- `app/(app)/assistant/page.tsx`
- `app/(app)/automations/page.tsx`
- `app/(app)/calendar/page.tsx`
- `app/(app)/chat/page.tsx`
- `app/(app)/data/page.tsx`
- `app/(app)/feeds/page.tsx`
- `app/(app)/fleet/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/(app)/shifts/page.tsx`
- `app/(app)/washers/page.tsx`

### Client Components Fixed (error handling)
- `app/(app)/washers/task-queue-table.tsx`
- `app/(app)/washers/daily-register-client.tsx`
- `app/(app)/feeds/feed-items-table.tsx`
- `app/(app)/feeds/feed-source-keywords.tsx`
- `app/(app)/fleet/bulk-fleet-bar.tsx`
- `app/(app)/shifts/bulk-shift-bar.tsx`
- `app/(app)/notifications/notifications-list.tsx`
- `app/(app)/ops-inbox/ops-inbox-actions-ui.tsx`

### New Tests
- `tests/unit/submit-button.test.ts` — Component export verification

## Verification

```bash
pnpm lint         # 0 errors, 0 warnings
pnpm typecheck    # Clean
pnpm test:unit    # 583 passed (43 files)
pnpm build        # Success
```

## What Remains (Not in Scope)

- **All Prisma-backed features show empty data**: Supabase unreachable from Vercel. This is the fundamental architecture issue (P1 in PRIORITIZED_BACKLOG.md) — requires completing Convex migration for each module.
- **Feature flags**: Some modules gated behind env vars not set in Vercel (e.g., VIBER_*, OPENROUTER_API_KEY). These controls render but backend is disabled — acceptable, documented in DIAG_REPORT.md.
