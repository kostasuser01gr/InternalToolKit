/**
 * Playwright global setup:
 * 1) assert required Prisma tables exist before tests start
 * 2) clear auth throttle records to prevent test-to-test lockout interference
 */
import { execSync } from "node:child_process";

export default async function globalSetup() {
  const dbUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";

  try {
    const schemaCountRaw = execSync(
      "PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d internal_toolkit -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('_prisma_migrations','User');\"",
      {
        stdio: "pipe",
        timeout: 20000,
      },
    )
      .toString()
      .trim();
    const schemaCount = Number.parseInt(schemaCountRaw, 10);
    if (!Number.isFinite(schemaCount) || schemaCount < 2) {
      throw new Error(`Missing required tables (_prisma_migrations/User). count=${schemaCountRaw || "unknown"}`);
    }

    execSync(
      "PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d internal_toolkit -c 'DELETE FROM \"AuthThrottle\";'",
      {
        stdio: "pipe",
        timeout: 10000,
      },
    );
    console.log("[global-setup] Schema assertion passed and AuthThrottle cleared via psql.");
  } catch {
    const fallbackScript = [
      "const { Client } = require('pg');",
      `const client = new Client({ connectionString: ${JSON.stringify(dbUrl)} });`,
      "client.connect()",
      "  .then(() => client.query(\"SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('_prisma_migrations','User')\"))",
      "  .then((res) => { if ((res.rows[0]?.count ?? 0) < 2) throw new Error('Missing required tables (_prisma_migrations/User).'); })",
      "  .then(() => client.query('DELETE FROM \"AuthThrottle\"'))",
      "  .then(() => client.end())",
      "  .catch((error) => { console.error(error.message); process.exit(1); });",
    ].join(" ");

    execSync(`node -e "${fallbackScript.replace(/"/g, '\\"')}"`, {
      stdio: "pipe",
      timeout: 20000,
    });
    console.log("[global-setup] Schema assertion passed and AuthThrottle cleared via pg fallback.");
  }
}
