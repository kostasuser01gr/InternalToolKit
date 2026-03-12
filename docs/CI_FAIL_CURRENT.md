# Current CI Failure Snapshot

- Repo: `kostasuser01gr/InternalToolKit`
- Workflow run: `22991051686`
- Workflow: `CI` (push)
- Failed job: `quality`
- Failed step: `E2E smoke tests` (`pnpm test:e2e`)

## Failing files and test cases

1. `apps/web/tests/smoke.spec.ts:299`  
   Test: `command palette opens and navigates` (Mobile)

## Exact error strings

- `Error: expect(page).toHaveURL(expected) failed`
- `Expected pattern: /\/analytics(\?|$)/`
- `Received string: "http://127.0.0.1:4173/overview"`
- `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @internal-toolkit/web@1.0.0 test:e2e`
- `ELIFECYCLE Command failed with exit code 1.`

## Notes

- Failure reproduced in both initial run and retry for the same mobile command-palette assertion.
- Environment values from CI logs are intentionally omitted here.
