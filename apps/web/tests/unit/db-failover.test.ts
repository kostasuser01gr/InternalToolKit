import { describe, expect, it, vi } from "vitest";

import {
  createDatabaseUrlCandidates,
  createSingleFailoverRunner,
} from "@/lib/db-failover";

describe("createDatabaseUrlCandidates", () => {
  it("prefers DATABASE_URL and uses DIRECT_URL as fallback when different", () => {
    const candidates = createDatabaseUrlCandidates({
      databaseUrl:
        "postgresql://postgres:pooler@db.example.com:6543/postgres?sslmode=require",
      directUrl:
        "postgresql://postgres:direct@db.example.com:5432/postgres?sslmode=require",
    });

    expect(candidates.primary).toContain(":6543/");
    expect(candidates.fallback).toContain(":5432/");
  });

  it("does not duplicate fallback when DIRECT_URL matches DATABASE_URL", () => {
    const url =
      "postgresql://postgres:password@db.example.com:6543/postgres?sslmode=require";
    const candidates = createDatabaseUrlCandidates({
      databaseUrl: url,
      directUrl: url,
    });

    expect(candidates.fallback).toBeNull();
  });
});

describe("createSingleFailoverRunner", () => {
  it("retries exactly once on connectivity errors", async () => {
    const runner = createSingleFailoverRunner({
      hasFallback: true,
      isConnectivityError: () => true,
    });
    let primaryCalls = 0;
    let fallbackCalls = 0;

    const first = await runner.run(
      async () => {
        primaryCalls += 1;
        throw new Error("P1001: can't reach database server");
      },
      async () => {
        fallbackCalls += 1;
        return "ok";
      },
    );

    expect(first).toBe("ok");
    expect(primaryCalls).toBe(1);
    expect(fallbackCalls).toBe(1);
    expect(runner.hasAttemptedFailover()).toBe(true);

    const fallbackSpy = vi.fn(async () => "still-not-called");

    await expect(
      runner.run(
        async () => {
          throw new Error("P1001: can't reach database server");
        },
        fallbackSpy,
      ),
    ).rejects.toThrow("P1001");

    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  it("does not retry for non-connectivity errors", async () => {
    const runner = createSingleFailoverRunner({
      hasFallback: true,
      isConnectivityError: () => false,
    });
    const fallbackSpy = vi.fn(async () => "unused");

    await expect(
      runner.run(
        async () => {
          throw new Error("P2002: unique constraint");
        },
        fallbackSpy,
      ),
    ).rejects.toThrow("P2002");

    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(runner.hasAttemptedFailover()).toBe(false);
  });
});
