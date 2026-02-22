import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── CronRun + DeadLetter Schema ──────────────────────────────────────────────

describe("CronRun + DeadLetter Prisma models", () => {
  const schema = readFileSync(
    resolve(__dirname, "../../prisma/schema.prisma"),
    "utf-8",
  );

  it("CronRun model exists in schema", () => {
    expect(schema).toContain("model CronRun {");
    expect(schema).toContain("job");
    expect(schema).toContain("startedAt");
    expect(schema).toContain("finishedAt");
    expect(schema).toContain("status");
    expect(schema).toContain("itemsProcessed");
    expect(schema).toContain("errorSummary");
  });

  it("DeadLetterEntry model exists in schema", () => {
    expect(schema).toContain("model DeadLetterEntry {");
    expect(schema).toContain("type");
    expect(schema).toContain("payload");
    expect(schema).toContain("attempts");
    expect(schema).toContain("resolvedAt");
  });

  it("migration file exists", () => {
    const migrationDir = resolve(
      __dirname,
      "../../prisma/migrations/20260222180645_wave7_cron_deadletter",
    );
    const sql = readFileSync(resolve(migrationDir, "migration.sql"), "utf-8");
    expect(sql).toContain("CronRun");
    expect(sql).toContain("DeadLetterEntry");
  });
});

// ─── Cron persistence ─────────────────────────────────────────────────────────

describe("Cron run DB persistence", () => {
  it("getCronRunLog is async and returns array", async () => {
    const { getCronRunLog } = await import("@/app/api/cron/daily/route");
    const result = await getCronRunLog();
    expect(Array.isArray(result)).toBe(true);
  });

  it("cron route uses logRunToDB instead of in-memory logRun", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/cron/daily/route.ts"),
      "utf-8",
    );
    expect(src).toContain("logRunToDB");
    expect(src).not.toContain("cronRunLog.push");
    expect(src).not.toContain("MAX_LOG_ENTRIES");
  });

  it("cron housekeeping purges old CronRun entries", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/cron/daily/route.ts"),
      "utf-8",
    );
    expect(src).toContain("cronRun.deleteMany");
    expect(src).toContain("CRON_LOG_RETENTION_DAYS");
  });

  it("cron housekeeping purges resolved dead-letter entries", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/cron/daily/route.ts"),
      "utf-8",
    );
    expect(src).toContain("deadLetterEntry.deleteMany");
    expect(src).toContain("resolvedAt");
  });
});

// ─── Dead-letter persistence ──────────────────────────────────────────────────

describe("Viber dead-letter DB persistence", () => {
  it("bridge imports db module", () => {
    const src = readFileSync(
      resolve(__dirname, "../../lib/viber/bridge.ts"),
      "utf-8",
    );
    expect(src).toContain('import { db }');
  });

  it("addToDeadLetter writes to DB", () => {
    const src = readFileSync(
      resolve(__dirname, "../../lib/viber/bridge.ts"),
      "utf-8",
    );
    expect(src).toContain("db.deadLetterEntry.create");
    expect(src).toContain("db.deadLetterEntry.update");
    expect(src).not.toContain("deadLetterQueue.push");
  });

  it("retryDeadLetters reads from DB", () => {
    const src = readFileSync(
      resolve(__dirname, "../../lib/viber/bridge.ts"),
      "utf-8",
    );
    expect(src).toContain("db.deadLetterEntry.findMany");
    expect(src).toContain("resolvedAt: new Date()");
  });

  it("getBridgeStatus queries DB for dead-letter count", () => {
    const src = readFileSync(
      resolve(__dirname, "../../lib/viber/bridge.ts"),
      "utf-8",
    );
    expect(src).toContain("db.deadLetterEntry.count");
    expect(src).toContain("async function getBridgeStatus");
  });
});
