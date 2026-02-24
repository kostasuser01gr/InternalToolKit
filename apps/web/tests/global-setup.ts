/**
 * Playwright global setup: clears auth throttle records to prevent
 * test-to-test lockout interference (all tests share 127.0.0.1 IP).
 */
import { execSync } from "node:child_process";

export default function globalSetup() {
  const dbUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";

  // Try psql first (most reliable for raw SQL)
  const methods = [
    () => {
      execSync(
        `PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d internal_toolkit -c 'DELETE FROM "AuthThrottle";'`,
        { stdio: "pipe", timeout: 5000 },
      );
      return "psql";
    },
    () => {
      execSync(
        `node -e "const { Client } = require('pg'); const c = new Client('${dbUrl}'); c.connect().then(() => c.query('DELETE FROM \\\"AuthThrottle\\\"')).then(() => c.end())"`,
        { stdio: "pipe", timeout: 10000 },
      );
      return "pg";
    },
  ];

  for (const method of methods) {
    try {
      const name = method();
      console.log(`[global-setup] Cleared AuthThrottle via ${name}`);
      return;
    } catch {
      // Try next method
    }
  }

  console.warn("[global-setup] Could not clear AuthThrottle (non-fatal)");
}
