import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { getServerEnv } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

const DEFAULT_DATABASE_URL = "file:./dev.db";
const configuredDatabaseUrl = getServerEnv().DATABASE_URL || DEFAULT_DATABASE_URL;

const adapter = new PrismaLibSql({
  url: configuredDatabaseUrl,
});

export const db = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
