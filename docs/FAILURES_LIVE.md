# FAILURES LIVE TRIAGE

Generated: 2026-03-03
Repo: `kostasuser01gr/InternalToolKit`

## Current Workflow State

- `CI` run `22627720711`: `success`
- `Lighthouse CI` run `22627720676`: `success`
- `CodeQL` run `22627720679`: `success`

## Newest Failed Run Evidence

1. Run `22526903904`
- Workflow: `CI`
- Job: `quality`
- Step: `E2E smoke tests`
- Root error signatures:
- `expect(page).toHaveURL(/\/analytics$/)` timed out while URL stayed `/overview`
- `expect(page).toHaveURL(/\/(dashboard|overview)$/)` timed out while URL stayed `/analytics`
- `expect(locator).toBeVisible()` failed for toast text `Table created.` and `Field created.`
- `page.goto` timeout in `tests/modules.spec.ts` on route navigation

2. Run `22522248417`
- Workflow: `CI`
- Job: `quality`
- Step: `E2E smoke tests`
- Root error signatures:
- `expect(page).toHaveURL(/\/analytics$/)` timed out while URL stayed `/overview`
- `expect(page).toHaveURL(/\/(dashboard|overview)$/)` timed out while URL stayed `/analytics`
- `page.goto: net::ERR_ABORTED` for `/controls` and `/data`

## Triage Conclusion

- Confirmed by `gh run list`: latest runs are green.
- Failed-run signatures are historical E2E flake categories (command palette navigation, intermittent route aborts, and transient UI assertions).
- No currently failing workflow in latest push window.
