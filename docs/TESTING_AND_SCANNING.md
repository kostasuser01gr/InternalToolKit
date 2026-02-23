# Testing & Scanning Guide

## Local Commands

### Lint + Type Check
```bash
pnpm lint              # ESLint (all packages, 0 warnings enforced)
pnpm typecheck         # TypeScript --noEmit (all packages)
```

### Unit Tests
```bash
pnpm test:unit         # Vitest (apps/web) — 581+ tests
```

### E2E Tests (Playwright)
```bash
pnpm test:e2e          # Resets DB + runs Playwright (3 viewports)
pnpm --filter @internal-toolkit/web test:ui  # Interactive Playwright UI
```

Playwright projects: Desktop (1440×900), Tablet (iPad gen 7), Mobile (iPhone 14).

Traces and screenshots are captured only on failure.

### Accessibility (axe-core)
```bash
pnpm test:e2e          # a11y.spec.ts runs as part of E2E suite
```

The `tests/a11y.spec.ts` file scans `/login` and `/api/health` for WCAG 2.1 AA violations. Critical/serious violations fail the test.

### Lighthouse CI (Performance)
```bash
npm install -g @lhci/cli
pnpm build
lhci autorun           # Runs against /login and /api/health
```

Configuration: `lighthouserc.js` at repo root.

Budgets:
- Performance: warn below 0.5
- Accessibility: fail below 0.7
- Best Practices: warn below 0.7

### Dependency Audit
```bash
pnpm audit:deps        # Checks production deps for high/critical vulns
pnpm audit:deps:fix    # Auto-fix where possible
```

### Environment Check
```bash
pnpm --filter @internal-toolkit/web env:check   # Validates required env names
```

### Build
```bash
pnpm build             # Full monorepo build (shared → api → web)
```

## CI Workflows

| Workflow | File | Trigger | What it does |
|----------|------|---------|-------------|
| **CI** | `ci.yml` | push, PR | Lint, typecheck, unit tests, E2E, build, dep audit |
| **CodeQL** | `codeql.yml` | push to main, PR to main, weekly | SAST scanning (JS/TS) |
| **Dependency Review** | `dependency-review.yml` | PR to main | Blocks PRs with high-severity new dependencies |
| **Lighthouse CI** | `lighthouse.yml` | push to main, PR to main | Performance + accessibility audit |

### CI Pipeline Steps
1. Checkout → pnpm install → Prisma migrate
2. Lint → Typecheck → Unit tests
3. Install Playwright → E2E smoke tests
4. Build → Dependency audit
5. Upload traces on failure

### Artifacts
- **playwright-traces**: Uploaded on E2E failure (7-day retention)
- **Lighthouse reports**: Uploaded to temporary-public-storage

## Adding New Tests

### Unit Test
Add to `apps/web/tests/unit/` with `.test.ts` extension. Uses Vitest.

### E2E Test
Add to `apps/web/tests/` with `.spec.ts` extension. Uses Playwright.

### Accessibility Test
Add pages to the `PAGES_TO_SCAN` array in `apps/web/tests/a11y.spec.ts`.
