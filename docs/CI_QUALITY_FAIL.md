# CI Quality Failure Summary

Source run: `22684653845` (`CI` workflow, branch `main`, commit `114b42d`)
Log source: `/tmp/ci_quality_failed.log`

## Failing job and step
- Job: `quality`
- Step: `E2E smoke tests` (`pnpm test:e2e`)
- Exit: `Process completed with exit code 1`

## Exact failing assertions
1. File: `apps/web/tests/smoke.spec.ts:443`
- Test: `chat basic flow: create thread and send message` (Desktop)
- Error: `expect(locator).toBeVisible()` failed for `getByText('Message sent.')`
- Observed URL in call log during failure: `/chat?...&success=Thread+created.`

2. File: `apps/web/tests/smoke.spec.ts:36` (retry path)
- Test retry failed in shared login helper
- Error: `expect(page).toHaveURL(/\/(overview|home|chat)$/)`
- Received URL: `/login`

3. Flaky precursor observed
- File: `apps/web/tests/modules.spec.ts:35` (Mobile, first attempt)
- Error: login helper timeout waiting for `/overview|/home|/chat`
- Received URL: `/login`
- Same test passed on retry, confirming nondeterministic login transition.

## Root-cause direction from logs
- Deterministic issue is in e2e flow timing/state handling (login transition + chat success assertion), not lint/type/build.
- Failure is concentrated in shared login helper assumptions and chat success banner assertion timing.

## Files to patch
- `apps/web/tests/smoke.spec.ts`
- `apps/web/tests/modules.spec.ts`
- scanner/report wiring for follow-up diagnostics:
  - `apps/web/tests/diagnostics/system-scan.spec.ts`
  - `apps/web/tests/diagnostics/system-scan-v2.spec.ts`
  - `apps/web/package.json`
