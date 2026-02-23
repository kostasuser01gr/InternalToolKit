import { describe, expect, it, vi } from "vitest";

// Mock db as null to simulate unreachable Prisma DB
vi.mock("@/lib/db", () => ({ db: null }));
vi.mock("@/lib/security-events", () => ({
  appendSecurityEvent: vi.fn(),
}));

import {
  checkAuthThrottle,
  buildAuthThrottleKeys,
  registerAuthFailure,
  registerAuthSuccess,
} from "@/lib/auth/throttle";

describe("auth throttle fail-open", () => {
  const keys = buildAuthThrottleKeys({
    ipAddress: "127.0.0.1",
    deviceId: "dev-1",
    accountIdentifier: "testuser",
  });

  it("checkAuthThrottle allows when db is null", async () => {
    const result = await checkAuthThrottle(keys);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.blockedBy).toEqual([]);
  });

  it("registerAuthFailure does not throw when db is null", async () => {
    await expect(
      registerAuthFailure(keys, { requestId: "r1", route: "/test" }),
    ).resolves.toBeUndefined();
  });

  it("registerAuthSuccess does not throw when db is null", async () => {
    await expect(
      registerAuthSuccess(keys, { requestId: "r2", route: "/test" }),
    ).resolves.toBeUndefined();
  });
});
