# Current CI Failure Snapshot

- Repo: `kostasuser01gr/InternalToolKit`
- Workflow run: `22729372393`
- Workflow: `CI` (push)
- Failed job: `quality`
- Failed step: `E2E smoke tests` (`pnpm test:e2e`)

## Failing files and test cases

1. `apps/web/tests/smoke.spec.ts:392`  
   Test: `data table: create table, add field, add record, export CSV` (Desktop)

## Exact error strings

- `Error: expect(locator).toBeVisible() failed`
- `Locator: getByText('hello world')`
- `Error: element(s) not found`
- `TimeoutError: page.waitForURL: Timeout 30000ms exceeded.`
- `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @internal-toolkit/web@1.0.0 test:e2e`
- `ELIFECYCLE Command failed with exit code 1.`

## Additional flaky signal (did not hard-fail this run)

1. `apps/web/tests/smoke.spec.ts:299`  
   Test: `command palette opens and navigates` (Mobile)

Observed retry-only message:
- `Error: expect(page).toHaveURL(expected) failed`
- `Expected pattern: /\/analytics(\?|$)/`
- `Received string: "http://127.0.0.1:4173/overview"`

## Notes

- This snapshot is from failed-step logs only (`gh run view --log-failed`).
- Environment values from CI logs are intentionally omitted here.
