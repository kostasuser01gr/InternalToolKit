import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

const envFiles = [".env.local", ".env"];

for (const envFile of envFiles) {
  const envPath = resolve(process.cwd(), envFile);

  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false, quiet: true });
  }
}

process.env.DATABASE_URL ??= "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
