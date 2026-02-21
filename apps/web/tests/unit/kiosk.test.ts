import { describe, expect, it } from "vitest";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Unit tests for the Washer Kiosk API features:
 * - Kiosk token validation (constant-time comparison)
 * - Rate limiting by deviceId + stationId
 * - Idempotency/dedupe schema validation
 * - Washer task schema fields
 */

// ---------------------------------------------------------------------------
// Kiosk token validation (extracted logic for testability)
// ---------------------------------------------------------------------------

function validateKioskToken(token: string, expected: string): boolean {
  if (!expected) return false;
  if (!token) return false;
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

describe("kiosk token validation", () => {
  const SECRET = "my-super-secret-kiosk-token-32ch";

  it("accepts valid token", () => {
    expect(validateKioskToken(SECRET, SECRET)).toBe(true);
  });

  it("rejects empty token", () => {
    expect(validateKioskToken("", SECRET)).toBe(false);
  });

  it("rejects wrong token", () => {
    expect(validateKioskToken("wrong-token-with-same-length!!!!!", SECRET)).toBe(false);
  });

  it("rejects when expected is empty (no KIOSK_TOKEN configured)", () => {
    expect(validateKioskToken("any-token", "")).toBe(false);
  });

  it("rejects token of different length", () => {
    expect(validateKioskToken("short", SECRET)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting for kiosk
// ---------------------------------------------------------------------------

describe("kiosk rate limiting", () => {
  it("allows up to 30 requests per device/station combo in a 60s window", () => {
    const key = "kiosk:device-1:station-1";
    const limit = 30;
    const windowMs = 60_000;
    const baseTime = 100_000;

    for (let i = 0; i < 30; i++) {
      const result = checkRateLimit({ key, limit, windowMs, nowMs: baseTime + i * 100 });
      expect(result.allowed).toBe(true);
    }

    // 31st request should be blocked
    const blocked = checkRateLimit({ key, limit, windowMs, nowMs: baseTime + 3000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses separate buckets for different device/station combos", () => {
    const key1 = "kiosk:device-A:station-X";
    const key2 = "kiosk:device-B:station-X";
    const limit = 1;
    const windowMs = 60_000;
    const now = 200_000;

    const r1 = checkRateLimit({ key: key1, limit, windowMs, nowMs: now });
    const r2 = checkRateLimit({ key: key2, limit, windowMs, nowMs: now });

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);

    // Second request on key1 should be blocked, key2 still fine
    const r1b = checkRateLimit({ key: key1, limit, windowMs, nowMs: now + 100 });
    expect(r1b.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency key / dedupe validation (schema level)
// ---------------------------------------------------------------------------

describe("kiosk idempotency key validation", () => {
  const idempotencyKeySchema = z.string().uuid();

  it("accepts valid UUIDs", () => {
    expect(
      idempotencyKeySchema.safeParse("123e4567-e89b-12d3-a456-426614174000").success,
    ).toBe(true);
    expect(
      idempotencyKeySchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success,
    ).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(idempotencyKeySchema.safeParse("not-a-uuid").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("12345").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Washer task schema - kiosk fields
// ---------------------------------------------------------------------------

describe("washer task schema kiosk fields", () => {
  const createKioskTaskSchema = z.object({
    workspaceId: z.string().min(1),
    vehicleId: z.string().min(1),
    idempotencyKey: z.string().uuid(),
    deviceId: z.string().min(1).max(120),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]).default("TODO"),
    exteriorDone: z.boolean().default(false),
    interiorDone: z.boolean().default(false),
    vacuumDone: z.boolean().default(false),
    notes: z.string().trim().max(1000).optional(),
    voiceTranscript: z.string().trim().max(1000).optional(),
  });

  it("accepts valid kiosk task payload", () => {
    const payload = {
      workspaceId: "ws-1",
      vehicleId: "v-1",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      deviceId: "device-abc",
      status: "TODO",
    };
    expect(createKioskTaskSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects payload missing required fields", () => {
    expect(createKioskTaskSchema.safeParse({}).success).toBe(false);
    expect(
      createKioskTaskSchema.safeParse({ workspaceId: "ws" }).success,
    ).toBe(false);
  });

  it("rejects payload with invalid idempotencyKey", () => {
    const payload = {
      workspaceId: "ws-1",
      vehicleId: "v-1",
      idempotencyKey: "not-valid",
      deviceId: "dev-1",
    };
    expect(createKioskTaskSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects deviceId exceeding max length", () => {
    const payload = {
      workspaceId: "ws-1",
      vehicleId: "v-1",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      deviceId: "x".repeat(121),
    };
    expect(createKioskTaskSchema.safeParse(payload).success).toBe(false);
  });

  it("defaults status to TODO when not provided", () => {
    const payload = {
      workspaceId: "ws-1",
      vehicleId: "v-1",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      deviceId: "dev-1",
    };
    const result = createKioskTaskSchema.parse(payload);
    expect(result.status).toBe("TODO");
  });
});
