import { describe, it, expect } from "vitest";

import {
  isValidPipelineTransition,
  allowedPipelineTransitions,
  BLOCKER_TYPES,
  QC_CHECKLIST_ITEMS,
  computeSlaDeadline,
  isSlaBreached,
  slaMinutesRemaining,
  canSignoffQc,
} from "@/lib/fleet-pipeline";

describe("Fleet Pipeline v2 — State Machine", () => {
  it("allows RETURNED → NEEDS_CLEANING", () => {
    expect(isValidPipelineTransition("RETURNED", "NEEDS_CLEANING")).toBe(true);
  });

  it("allows RETURNED → BLOCKED", () => {
    expect(isValidPipelineTransition("RETURNED", "BLOCKED")).toBe(true);
  });

  it("disallows RETURNED → READY (skip stages)", () => {
    expect(isValidPipelineTransition("RETURNED", "READY")).toBe(false);
  });

  it("disallows same-state transition", () => {
    expect(isValidPipelineTransition("READY", "READY")).toBe(false);
  });

  it("allows BLOCKED → any recovery state", () => {
    const allowed = allowedPipelineTransitions("BLOCKED");
    expect(allowed).toContain("RETURNED");
    expect(allowed).toContain("NEEDS_CLEANING");
    expect(allowed).toContain("MAINTENANCE");
  });

  it("allows QC_PENDING → NEEDS_CLEANING (rework)", () => {
    expect(isValidPipelineTransition("QC_PENDING", "NEEDS_CLEANING")).toBe(true);
  });

  it("allows QC_PENDING → READY (pass)", () => {
    expect(isValidPipelineTransition("QC_PENDING", "READY")).toBe(true);
  });

  it("allows READY → RENTED", () => {
    expect(isValidPipelineTransition("READY", "RENTED")).toBe(true);
  });

  it("allows RENTED → RETURNED", () => {
    expect(isValidPipelineTransition("RENTED", "RETURNED")).toBe(true);
  });
});

describe("Fleet Pipeline v2 — Blocker Types", () => {
  it("includes expected blocker types", () => {
    expect(BLOCKER_TYPES).toContain("no_key");
    expect(BLOCKER_TYPES).toContain("damage");
    expect(BLOCKER_TYPES).toContain("low_fuel");
    expect(BLOCKER_TYPES).toContain("docs_missing");
    expect(BLOCKER_TYPES).toContain("waiting_parts");
  });

  it("has 6 blocker types", () => {
    expect(BLOCKER_TYPES).toHaveLength(6);
  });
});

describe("Fleet Pipeline v2 — QC Checklist", () => {
  it("has 8 checklist items", () => {
    expect(QC_CHECKLIST_ITEMS).toHaveLength(8);
  });

  it("includes key_present and docs_present", () => {
    const ids = QC_CHECKLIST_ITEMS.map((i) => i.id);
    expect(ids).toContain("key_present");
    expect(ids).toContain("docs_present");
  });
});

describe("Fleet Pipeline — SLA (existing)", () => {
  it("computes SLA deadline for NEEDS_CLEANING (30 min)", () => {
    const from = new Date("2026-01-01T10:00:00Z");
    const deadline = computeSlaDeadline("NEEDS_CLEANING" as never, from);
    expect(deadline).not.toBeNull();
    expect(deadline!.getTime() - from.getTime()).toBe(30 * 60_000);
  });

  it("isSlaBreached returns true when overdue", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:31:00Z").getTime();
    expect(isSlaBreached("NEEDS_CLEANING" as never, enteredAt, now)).toBe(true);
  });

  it("slaMinutesRemaining returns correct value", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:20:00Z").getTime();
    const remaining = slaMinutesRemaining("NEEDS_CLEANING" as never, enteredAt, now);
    expect(remaining).toBeCloseTo(10, 0);
  });
});

describe("Fleet Pipeline — QC Signoff Roles", () => {
  it("ADMIN can signoff", () => {
    expect(canSignoffQc("ADMIN")).toBe(true);
  });

  it("WASHER cannot signoff", () => {
    expect(canSignoffQc("WASHER")).toBe(false);
  });
});
