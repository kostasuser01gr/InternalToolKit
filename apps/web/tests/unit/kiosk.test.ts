import { describe, expect, it } from "vitest";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Unit tests for the Washer Kiosk API features:
 * - Kiosk token validation (constant-time comparison)
 * - Rate limiting by deviceId + stationId
 * - Idempotency/dedupe schema validation
 * - Washer task schema fields
 * - Preset application logic
 * - Quick Plate vehicle lookup
 * - Offline queue enqueue/dedupe
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

// ---------------------------------------------------------------------------
// Preset application logic
// ---------------------------------------------------------------------------

type Preset = {
  label: string;
  exterior: boolean;
  interior: boolean;
  vacuum: boolean;
  priorityNotes: string | undefined;
};

const PRESETS: Preset[] = [
  { label: "Basic", exterior: true, interior: false, vacuum: false, priorityNotes: undefined },
  { label: "Full", exterior: true, interior: true, vacuum: true, priorityNotes: undefined },
  { label: "Express", exterior: true, interior: false, vacuum: true, priorityNotes: undefined },
  { label: "VIP", exterior: true, interior: true, vacuum: true, priorityNotes: "VIP — priority wash" },
];

function applyPreset(preset: Preset): { exterior: boolean; interior: boolean; vacuum: boolean; notes: string } {
  return {
    exterior: preset.exterior,
    interior: preset.interior,
    vacuum: preset.vacuum,
    notes: preset.priorityNotes ?? "",
  };
}

describe("kiosk preset application", () => {
  it("Basic preset: exterior only", () => {
    const result = applyPreset(PRESETS[0]!);
    expect(result.exterior).toBe(true);
    expect(result.interior).toBe(false);
    expect(result.vacuum).toBe(false);
    expect(result.notes).toBe("");
  });

  it("Full preset: exterior + interior + vacuum", () => {
    const result = applyPreset(PRESETS[1]!);
    expect(result.exterior).toBe(true);
    expect(result.interior).toBe(true);
    expect(result.vacuum).toBe(true);
    expect(result.notes).toBe("");
  });

  it("Express preset: exterior + vacuum only", () => {
    const result = applyPreset(PRESETS[2]!);
    expect(result.exterior).toBe(true);
    expect(result.interior).toBe(false);
    expect(result.vacuum).toBe(true);
    expect(result.notes).toBe("");
  });

  it("VIP preset: all services + priority note", () => {
    const result = applyPreset(PRESETS[3]!);
    expect(result.exterior).toBe(true);
    expect(result.interior).toBe(true);
    expect(result.vacuum).toBe(true);
    expect(result.notes).toBe("VIP — priority wash");
  });

  it("all presets have valid labels", () => {
    const labels = PRESETS.map((p) => p.label);
    expect(labels).toEqual(["Basic", "Full", "Express", "VIP"]);
  });

  it("all presets have exterior enabled", () => {
    for (const preset of PRESETS) {
      expect(preset.exterior).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Quick Plate vehicle lookup
// ---------------------------------------------------------------------------

type Vehicle = { id: string; plateNumber: string; model: string };

function findVehicleByPlate(query: string, vehicles: Vehicle[]): Vehicle | undefined {
  const q = query.toUpperCase();
  return vehicles.find((v) => v.plateNumber.toUpperCase() === q)
    ?? vehicles.find((v) => v.plateNumber.toUpperCase().includes(q));
}

describe("quick plate vehicle lookup", () => {
  const vehicles: Vehicle[] = [
    { id: "v1", plateNumber: "ABC1234", model: "Toyota Yaris" },
    { id: "v2", plateNumber: "XYZ9999", model: "BMW 320i" },
    { id: "v3", plateNumber: "DEF5678", model: "Audi A4" },
  ];

  it("finds exact match case-insensitively", () => {
    expect(findVehicleByPlate("abc1234", vehicles)?.id).toBe("v1");
    expect(findVehicleByPlate("ABC1234", vehicles)?.id).toBe("v1");
  });

  it("finds partial match when no exact match", () => {
    expect(findVehicleByPlate("ABC", vehicles)?.id).toBe("v1");
    expect(findVehicleByPlate("DEF", vehicles)?.id).toBe("v3");
  });

  it("returns undefined when no match found", () => {
    expect(findVehicleByPlate("ZZZ0000", vehicles)).toBeUndefined();
  });

  it("exact match takes priority over partial match", () => {
    const overlappingVehicles: Vehicle[] = [
      { id: "v10", plateNumber: "AB1", model: "Car A" },
      { id: "v11", plateNumber: "AB123", model: "Car B" },
    ];
    // "AB1" is both exact for v10 and partial for v11
    expect(findVehicleByPlate("AB1", overlappingVehicles)?.id).toBe("v10");
  });
});

// ---------------------------------------------------------------------------
// Offline queue: enqueue, dedupe, flush semantics
// ---------------------------------------------------------------------------

type QueuedTask = {
  idempotencyKey: string;
  vehicleId: string;
  status: "pending" | "synced" | "failed";
  createdAt: string;
};

function enqueueTask(queue: QueuedTask[], task: QueuedTask): QueuedTask[] {
  // Prevent duplicate idempotencyKey entries
  if (queue.some((t) => t.idempotencyKey === task.idempotencyKey)) {
    return queue;
  }
  return [task, ...queue];
}

function markSynced(queue: QueuedTask[], idempotencyKey: string): QueuedTask[] {
  return queue.map((t) =>
    t.idempotencyKey === idempotencyKey ? { ...t, status: "synced" } : t,
  );
}

function markFailed(queue: QueuedTask[], idempotencyKey: string): QueuedTask[] {
  return queue.map((t) =>
    t.idempotencyKey === idempotencyKey ? { ...t, status: "failed" } : t,
  );
}

describe("offline queue logic", () => {
  const makeTask = (key: string): QueuedTask => ({
    idempotencyKey: key,
    vehicleId: "v1",
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  it("enqueues a new task at the front", () => {
    const q = enqueueTask([], makeTask("key-1"));
    expect(q).toHaveLength(1);
    expect(q[0]!.idempotencyKey).toBe("key-1");
  });

  it("does not duplicate a task with the same idempotencyKey", () => {
    let q: QueuedTask[] = [];
    q = enqueueTask(q, makeTask("key-dup"));
    q = enqueueTask(q, makeTask("key-dup"));
    expect(q).toHaveLength(1);
  });

  it("allows multiple tasks with different keys", () => {
    let q: QueuedTask[] = [];
    q = enqueueTask(q, makeTask("key-a"));
    q = enqueueTask(q, makeTask("key-b"));
    expect(q).toHaveLength(2);
  });

  it("transitions pending -> synced on successful flush", () => {
    let q = enqueueTask([], makeTask("key-sync"));
    q = markSynced(q, "key-sync");
    expect(q[0]!.status).toBe("synced");
  });

  it("transitions pending -> failed on error", () => {
    let q = enqueueTask([], makeTask("key-fail"));
    q = markFailed(q, "key-fail");
    expect(q[0]!.status).toBe("failed");
  });

  it("retains other tasks when one transitions", () => {
    let q: QueuedTask[] = [];
    q = enqueueTask(q, makeTask("key-1"));
    q = enqueueTask(q, makeTask("key-2"));
    q = markSynced(q, "key-1");
    expect(q.find((t) => t.idempotencyKey === "key-2")?.status).toBe("pending");
    expect(q.find((t) => t.idempotencyKey === "key-1")?.status).toBe("synced");
  });
});

// ---------------------------------------------------------------------------
// Kiosk task update schema (PATCH endpoint)
// ---------------------------------------------------------------------------

describe("kiosk task update schema", () => {
  const updateSchema = z.object({
    workspaceId: z.string().min(1),
    deviceId: z.string().min(1).max(120),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]),
  });

  it("accepts valid update payload", () => {
    const result = updateSchema.safeParse({
      workspaceId: "ws-1",
      deviceId: "device-abc",
      status: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing workspaceId", () => {
    expect(updateSchema.safeParse({ deviceId: "d", status: "DONE" }).success).toBe(false);
  });

  it("rejects invalid status value", () => {
    expect(
      updateSchema.safeParse({ workspaceId: "ws", deviceId: "d", status: "UNKNOWN" }).success,
    ).toBe(false);
  });

  it("accepts all valid status values", () => {
    for (const status of ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]) {
      expect(
        updateSchema.safeParse({ workspaceId: "ws", deviceId: "d", status }).success,
      ).toBe(true);
    }
  });
});
