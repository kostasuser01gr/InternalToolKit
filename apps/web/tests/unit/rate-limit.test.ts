import { describe, expect, it } from "vitest";

import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests within limit and blocks after threshold", () => {
    const key = "unit:test";
    const limit = 2;
    const windowMs = 60_000;

    const first = checkRateLimit({ key, limit, windowMs, nowMs: 1_000 });
    const second = checkRateLimit({ key, limit, windowMs, nowMs: 1_500 });
    const third = checkRateLimit({ key, limit, windowMs, nowMs: 2_000 });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets bucket after window passes", () => {
    const key = "unit:test:reset";
    const limit = 1;
    const windowMs = 1_000;

    const first = checkRateLimit({ key, limit, windowMs, nowMs: 10_000 });
    const blocked = checkRateLimit({ key, limit, windowMs, nowMs: 10_100 });
    const reset = checkRateLimit({ key, limit, windowMs, nowMs: 11_500 });

    expect(first.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
  });
});

