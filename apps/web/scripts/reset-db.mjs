import { execSync } from "node:child_process";

const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";

const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_LOCAL_DATABASE_URL;
const directUrl = process.env.DIRECT_URL?.trim() || databaseUrl;

if (databaseUrl.startsWith("file:") || directUrl.startsWith("file:")) {
  console.error(
    "file: sqlite URLs are not supported by the Postgres reset path. Set DATABASE_URL to Postgres.",
  );
  process.exit(1);
}

process.env.DATABASE_URL = directUrl;
process.env.DIRECT_URL = directUrl;

execSync("pnpm exec prisma migrate reset --force", {
  stdio: "inherit",
});

execSync("pnpm exec prisma db seed", {
  stdio: "inherit",
});
