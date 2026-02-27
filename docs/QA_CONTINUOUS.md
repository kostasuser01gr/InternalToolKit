# QA Continuous Verification

This project implements a "Full-Scale QA Loop" to ensure stability across local, CI, and production environments.

## Local Workflow

### Running Everything
To run all linting, typechecking, tests (unit + e2e + full-scan + a11y), and builds:

```bash
pnpm qa:all
```

### QA Loop (Stability Check)
To detect flakiness, use the loop script which runs the entire suite multiple times:

```bash
QA_LOOP_RUNS=3 ./scripts/qa-loop.sh
```

## Test Artifacts
On failure, Playwright and our diagnostic tools generate artifacts in `apps/web/test-results/`:
- **Traces/Videos**: Viewable via Playwright Trace Viewer.
- **Full-Scan Report**: `full-scan-report.json` contains route-by-route success/failure data.
- **A11y Reports**: `a11y-*/error-context.md` and screenshots for accessibility violations.

## CI Continuous Verification
GitHub Actions (`ci.yml`, `lighthouse.yml`) automatically runs the full suite on every push to `main` and all PRs.
- Artifacts are uploaded to the GitHub Run summary.
- Nightly runs perform the "Full-Scan" diagnostic on all routes.

## Production Verification
To verify the health of the production deployment:

```bash
./scripts/prod-check.sh
```

This script validates:
1. `/login` serves HTML (not redirected or JSON).
2. `/api/health` returns `{"ok":true}`.
3. Recent Vercel production logs for any 500s.
