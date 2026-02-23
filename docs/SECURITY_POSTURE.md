# Security Posture

## Static Analysis (SAST) — CodeQL

**Workflow**: `.github/workflows/codeql.yml`

- Scans JavaScript/TypeScript on every push to `main`, every PR, and weekly (Monday 03:27 UTC)
- Uses `security-and-quality` query suite (broader than default)
- Results appear in GitHub's **Security → Code scanning** tab
- SARIF reports uploaded automatically

### What it catches
- SQL injection, XSS, path traversal, prototype pollution
- Insecure crypto, hardcoded credentials, regex DoS
- Data flow from untrusted sources to sensitive sinks

## Dependency Review — PR Gate

**Workflow**: `.github/workflows/dependency-review.yml`

- Runs on every pull request to `main`
- Compares dependency changes between base and head
- **Blocks merge** if newly introduced dependencies have **high** or **critical** severity vulnerabilities
- Posts a summary comment on the PR

### What it catches
- Known CVEs in newly added or updated packages
- Supply-chain attacks via compromised packages

## Dependency Audit — pnpm audit

**CI**: Runs as the last step of the `CI` workflow  
**Local**: `pnpm audit:deps`

- Checks production dependencies against the npm advisory database
- Reports high/critical vulnerabilities
- Currently set to `continue-on-error: true` in CI (informational); can be hardened to blocking

## Runtime Security

### Secrets Management
- All secrets stored in Vercel Environment Variables (production + preview)
- `.env.local` for local dev (gitignored, never committed)
- `SESSION_SECRET` used for HMAC cookie signing (SHA-256)
- CSP headers enforced via Edge middleware (`proxy.ts`)

### Auth Security
- PIN-based and email/password authentication via Convex bcrypt actions
- Rate limiting via `authThrottle` (IP, account, device dimensions)
- Session cookies: HttpOnly, Secure (production), SameSite=Lax
- HMAC signature validation on every request
- Failed auth attempts logged to audit trail

### Health Endpoints (No Secret Exposure)
- `/api/health` — runtime status, never exposes env values
- `/api/health/db` — backend connectivity status (ok/error per backend)
- Missing env names reported; values never included

## Security Contacts

For security issues, open a private security advisory in the repository or contact the repository owner directly.
