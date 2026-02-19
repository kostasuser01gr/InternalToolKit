import { execSync } from "node:child_process";

const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";

const DATABASE_URL = process.env.DATABASE_URL?.trim() || DEFAULT_LOCAL_DATABASE_URL;
const DIRECT_URL = process.env.DIRECT_URL?.trim() || DATABASE_URL;

if (DATABASE_URL.startsWith("file:") || DIRECT_URL.startsWith("file:")) {
  console.error(
    [
      "file: sqlite URLs are not supported by the Postgres migration path.",
      "Set DATABASE_URL and DIRECT_URL to Postgres URLs before running migrations.",
    ].join("\n"),
  );
  process.exit(1);
}

process.env.DATABASE_URL = DIRECT_URL;
process.env.DIRECT_URL = DIRECT_URL;

execSync("pnpm exec prisma migrate deploy", {
  stdio: "inherit",
});
