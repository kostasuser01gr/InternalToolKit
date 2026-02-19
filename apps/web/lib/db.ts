import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getServerEnv } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

const { DATABASE_URL } = getServerEnv();
const adapter = new PrismaPg({ connectionString: DATABASE_URL });

export const db = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
