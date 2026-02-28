# FAILURES LIVE TRIAGE

## 1. CI / quality
- **Status**: FAILED (Run ID: 22519332383)
- **Failing Step**: `Install dependencies`
- **Error**: `ERR_PNPM_OUTDATED_LOCKFILE`
- **Root Cause**: `pnpm-lock.yaml` is not up to date with `<ROOT>/package.json`. Specifically, `next@16.1.6` was added to the root `package.json` but not updated in the lockfile.

## 2. Deploy Worker / deploy
- **Status**: FAILED (Run ID: 22519332392)
- **Failing Step**: `Install dependencies`
- **Error**: `ERR_PNPM_OUTDATED_LOCKFILE`
- **Root Cause**: Same as above. Outdated lockfile due to `next@16.1.6` addition.

## 3. Lighthouse CI / Performance audit
- **Status**: FAILED (Run ID: 22519332399)
- **Failing Step**: `Install dependencies`
- **Error**: `ERR_PNPM_OUTDATED_LOCKFILE`
- **Root Cause**: Same as above. Outdated lockfile due to `next@16.1.6` addition.

## 4. Vercel Deployments
- **Status**: FAILED (based on initial report)
- **Root Cause**: Likely related to the same dependency synchronization issues or build failures stemming from the outdated lockfile.
