# OPS SWEEP — BASELINE REPORT

Generated during Continuous Stabilization + Verification + Deployment Sweep.

---

## Tool Versions

| Tool    | Version         |
|---------|-----------------|
| Node.js | v20.20.0        |
| pnpm    | 10.29.2         |
| gh CLI  | 2.87.0          |
| vercel  | 50.22.0         |

---

## Phase 0 — Auth & CLI Status

- **GitHub CLI**: Authenticated as `kostasuser01gr` (token scopes: gist, read:org, repo, workflow)
- **Vercel CLI**: Authenticated as `kostasuser01gr`
- **Repo**: `kostasuser01gr/InternalToolKit` (monorepo: apps/web, apps/api, packages/shared)
- **Vercel Project**: `internal-tool-kit-web` (rootDirectory: apps/web)

---

## Baseline Scan — GH Run Status

All 10 most recent CI runs were ✅ green before any changes were made.

| Workflow             | Status |
|----------------------|--------|
| CI (main)            | ✓      |
| Copilot coding agent | ✓      |

### Open Issues
None.

### Open PRs
- #5, #6, #7 — `[WIP] Create RBAC matrix and governance specification` (Copilot branches)

---

## Baseline — Global Gates

| Gate                                         | Result                    |
|----------------------------------------------|---------------------------|
| `pnpm test:unit`                              | ⚠️ 1 pre-existing failure (`kpi-calculations.test.ts::staffingCoverageByHour`) |
| `pnpm typecheck`                              | ✅ Passed                 |
| `pnpm lint`                                  | ✅ Passed                 |
| `pnpm --filter @internal-toolkit/web build`  | ✅ Passed                 |

> **Pre-existing test failure**: `tests/unit/kpi-calculations.test.ts > staffingCoverageByHour > counts employees per hour` — present on remote main before any changes; unrelated to route crashes. Not fixed (out of scope).

---

## Security Scans

- **Dependabot alerts**: Disabled for this repository (HTTP 403, admin scope required).
- **Code scanning alerts**: Not configured (no GHAS analysis found).

---

## Vercel Environment Variables (Production)

| Key             | Environments      |
|-----------------|-------------------|
| `DATABASE_URL`  | Production, Preview |
| `DIRECT_URL`    | Production, Preview |
| `SESSION_SECRET`| Production, Preview |

All required env vars are set. ✅

---

## Root Cause — Production Crashes

Verified via `vercel logs --level error --json`:

| Route       | Error Code | Message                                               |
|-------------|------------|-------------------------------------------------------|
| `/settings` | P2021      | `table 'public.UserShortcut' does not exist`          |
| `/settings` | P2021      | `table 'public.PromptTemplate' does not exist`        |
| `/assistant`| P2022      | `column '(not available)' does not exist` (ChatMessage new cols) |
| `/washers`  | P2022      | `column '(not available)' does not exist`             |
| `/calendar` | P2022      | `column '(not available)' does not exist`             |

**Root cause**: Migration `20260220181000_cloud_free_unified_chat` was never applied
to the production Supabase database. This migration adds:
- Tables: `UserShortcut`, `UserActionButton`, `PromptTemplate`, `AiUsageMeter`, `ChatArtifact`
- Columns on `ChatMessage`: `modelId`, `latencyMs`, `tokenUsage`, `status`, `commandName`, `isPinned`

Additionally: The Supabase direct connection (port 5432) is unreachable from Vercel
build machines (P1001), preventing automated migration during build.
