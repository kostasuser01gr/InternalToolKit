/**
 * validate-env.ts — checks required env vars exist (names only, never prints values).
 * Usage: pnpm env:check
 */

import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env.local if present
config({ path: resolve(process.cwd(), ".env.local") });

const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SESSION_SECRET",
] as const;

const RECOMMENDED = [
  "CRON_SECRET",
  "KIOSK_TOKEN",
] as const;

const missing: string[] = [];
const missingRecommended: string[] = [];

for (const key of REQUIRED) {
  if (!process.env[key]?.trim()) missing.push(key);
}
for (const key of RECOMMENDED) {
  if (!process.env[key]?.trim()) missingRecommended.push(key);
}

if (missing.length > 0) {
  console.error("❌ Missing REQUIRED env vars:");
  for (const k of missing) console.error(`   - ${k}`);
  console.error("\nRun 'pnpm --filter @internal-toolkit/web setup:env' for local setup.");
  console.error("Add them to apps/web/.env.local (local) or Vercel env vars (prod).");
}

if (missingRecommended.length > 0) {
  console.warn("⚠️  Missing RECOMMENDED env vars (optional for local dev):");
  for (const k of missingRecommended) console.warn(`   - ${k}`);
}

if (missing.length === 0) {
  console.log("✅ All required env vars present.");
}

process.exit(missing.length > 0 ? 1 : 0);
