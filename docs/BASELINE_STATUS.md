# Baseline Status Snapshot

Date: 2026-03-05

## Current Commit At Snapshot
- `46b7684` fix(scan): resolve desktop route timeouts, hydration mismatch, and overview dead action

## GitHub Workflow Snapshot
Latest runs on `main` before this pass:
- CI `22723620913`: success
- CodeQL `22723620902`: success
- Lighthouse CI `22723620883`: success

## Runtime/Delivery State At Snapshot
- No active CI failures at snapshot time.
- Prior desktop diagnostics issues were already fixed.
- Remaining objective for this pass: complete backend migration to Railway while keeping frontend on Vercel.

## Tooling Snapshot
- `gh`: authenticated and repo accessible
- `vercel`: authenticated and project linked
- `railway`: authenticated and backend project linked (in `apps/api`)
- `convex`: available via `npx convex`
