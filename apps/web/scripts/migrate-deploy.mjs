import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_DATABASE_URL = "file:./dev.db";

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith("/")) {
    return rawPath;
  }

  return resolve(process.cwd(), rawPath);
}

function listMigrationSqlFiles() {
  const migrationsRoot = resolve(process.cwd(), "prisma/migrations");
  const entries = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return entries
    .map((entry) => resolve(migrationsRoot, entry, "migration.sql"))
    .filter((filePath) => existsSync(filePath));
}

function applyMigrationsWithSqlite(dbPath) {
  const migrationSqlFiles = listMigrationSqlFiles();

  if (migrationSqlFiles.length === 0) {
    throw new Error("No migration.sql files found in prisma/migrations.");
  }

  for (const sqlFile of migrationSqlFiles) {
    const sql = readFileSync(sqlFile, "utf8");
    const applied = spawnSync("sqlite3", [dbPath], {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
      encoding: "utf8",
    });

    if (applied.status !== 0) {
      throw new Error(`sqlite3 failed while applying ${sqlFile}`);
    }
  }
}

function runPrismaMigrateDeploy() {
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
  });
}

try {
  runPrismaMigrateDeploy();
} catch (error) {
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const sqlitePath = resolveSqlitePath(databaseUrl);

  if (!sqlitePath) {
    throw error;
  }

  if (existsSync(sqlitePath) && statSync(sqlitePath).size > 0) {
    throw error;
  }

  console.warn(
    "prisma migrate deploy failed, applying checked-in SQL migrations with sqlite3 fallback for fresh local DB.",
  );

  applyMigrationsWithSqlite(sqlitePath);
}
