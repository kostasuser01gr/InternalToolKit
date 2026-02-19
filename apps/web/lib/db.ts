import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { getServerEnv } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

const DEFAULT_DATABASE_URL = "file:./dev.db";
const FALLBACK_RUNTIME_DB = "/tmp/internal-toolkit-runtime.db";

function resolveFileDatabasePath(fileUrl: string) {
  if (!fileUrl.startsWith("file:")) {
    return null;
  }

  const rawPath = fileUrl.slice("file:".length);
  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith("/")) {
    return rawPath;
  }

  return resolve(process.cwd(), rawPath);
}

function ensureWritableRuntimeDatabase(sourceFilePath: string) {
  if (!existsSync(sourceFilePath)) {
    throw new Error(
      [
        "Database bootstrap failed: bundled sqlite file was not found.",
        `Expected: ${sourceFilePath}`,
        "Fix: set DATABASE_URL to a writable production database.",
      ].join(" "),
    );
  }

  // Always refresh the /tmp copy on cold start so schema updates are picked up.
  copyFileSync(sourceFilePath, FALLBACK_RUNTIME_DB);

  return `file:${FALLBACK_RUNTIME_DB}`;
}

function resolveRuntimeDatabaseUrl(configured: string) {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return configured;
  }

  const sourceFilePath = resolveFileDatabasePath(configured);
  if (!sourceFilePath) {
    return configured;
  }

  if (sourceFilePath.startsWith("/tmp/")) {
    return configured;
  }

  const fallback = ensureWritableRuntimeDatabase(sourceFilePath);
  return configured !== fallback ? fallback : configured;
}

const configuredDatabaseUrl = getServerEnv().DATABASE_URL || DEFAULT_DATABASE_URL;
const databaseUrl = resolveRuntimeDatabaseUrl(configuredDatabaseUrl);

const adapter = new PrismaLibSql({
  url: databaseUrl,
});

export const db = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
