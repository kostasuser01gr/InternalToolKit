import { describe, expect, it } from "vitest";

import {
  isValidTransition,
  allowedTransitions,
  canSignoffQc,
  isSlaBreached,
  slaMinutesRemaining,
  DEFAULT_SLA_CONFIGS,
  type FleetState,
} from "@/lib/fleet-pipeline";

describe("fleet pipeline state transitions", () => {
  it("allows RETURNED → NEEDS_CLEANING", () => {
    expect(isValidTransition("RETURNED", "NEEDS_CLEANING")).toBe(true);
  });

  it("allows NEEDS_CLEANING → CLEANING", () => {
    expect(isValidTransition("NEEDS_CLEANING", "CLEANING")).toBe(true);
  });

  it("allows CLEANING → QC", () => {
    expect(isValidTransition("CLEANING", "QC")).toBe(true);
  });

  it("allows QC → READY", () => {
    expect(isValidTransition("QC", "READY")).toBe(true);
  });

  it("allows QC → NEEDS_CLEANING (QC fail → reclean)", () => {
    expect(isValidTransition("QC", "NEEDS_CLEANING")).toBe(true);
  });

  it("rejects RETURNED → READY (skip steps)", () => {
    expect(isValidTransition("RETURNED", "READY")).toBe(false);
  });

  it("rejects READY → QC (backward without re-entry)", () => {
    expect(isValidTransition("READY", "QC")).toBe(false);
  });

  it("rejects same-state transition", () => {
    expect(isValidTransition("CLEANING", "CLEANING")).toBe(false);
  });

  it("allows any state → BLOCKED", () => {
    const states: FleetState[] = ["RETURNED", "NEEDS_CLEANING", "CLEANING", "QC", "READY"];
    for (const s of states) {
      expect(isValidTransition(s, "BLOCKED")).toBe(true);
    }
  });

  it("allows any state → MAINTENANCE", () => {
    const states: FleetState[] = ["RETURNED", "NEEDS_CLEANING", "CLEANING", "QC", "READY"];
    for (const s of states) {
      expect(isValidTransition(s, "MAINTENANCE")).toBe(true);
    }
  });

  it("allowedTransitions returns correct set for CLEANING", () => {
    const allowed = allowedTransitions("CLEANING");
    expect(allowed).toContain("QC");
    expect(allowed).toContain("BLOCKED");
    expect(allowed).toContain("MAINTENANCE");
    expect(allowed).not.toContain("READY");
    expect(allowed).not.toContain("RETURNED");
  });
});

describe("QC permission enforcement", () => {
  it("allows ADMIN to sign off QC", () => {
    expect(canSignoffQc("ADMIN")).toBe(true);
  });

  it("allows EDITOR to sign off QC", () => {
    expect(canSignoffQc("EDITOR")).toBe(true);
  });

  it("rejects WASHER from QC signoff", () => {
    expect(canSignoffQc("WASHER")).toBe(false);
  });

  it("rejects EMPLOYEE from QC signoff", () => {
    expect(canSignoffQc("EMPLOYEE")).toBe(false);
  });

  it("rejects VIEWER from QC signoff", () => {
    expect(canSignoffQc("VIEWER")).toBe(false);
  });
});

describe("SLA alert trigger logic", () => {
  it("does not breach SLA when within time limit", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:20:00Z").getTime(); // 20 min
    expect(isSlaBreached("CLEANING", enteredAt, now)).toBe(false);
  });

  it("breaches SLA when over time limit", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:50:00Z").getTime(); // 50 min > 45 limit
    expect(isSlaBreached("CLEANING", enteredAt, now)).toBe(true);
  });

  it("returns false for states with no SLA config", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-02T10:00:00Z").getTime(); // 24h later
    expect(isSlaBreached("READY", enteredAt, now)).toBe(false);
  });

  it("accepts ISO string for enteredAt", () => {
    const now = new Date("2026-01-01T11:00:00Z").getTime(); // 60 min
    expect(isSlaBreached("CLEANING", "2026-01-01T10:00:00Z", now)).toBe(true);
  });

  it("respects custom SLA overrides", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:10:00Z").getTime(); // 10 min
    const overrides = { CLEANING: { maxMinutes: 5 } } as const;
    expect(isSlaBreached("CLEANING", enteredAt, now, overrides)).toBe(true);
  });

  it("slaMinutesRemaining returns correct value", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:30:00Z").getTime(); // 30 min
    const remaining = slaMinutesRemaining("CLEANING", enteredAt, now);
    expect(remaining).toBe(15); // 45 - 30 = 15
  });

  it("slaMinutesRemaining returns 0 when breached", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T11:00:00Z").getTime(); // 60 min
    const remaining = slaMinutesRemaining("CLEANING", enteredAt, now);
    expect(remaining).toBe(0);
  });

  it("slaMinutesRemaining returns null for states without SLA", () => {
    const remaining = slaMinutesRemaining("READY", new Date(), Date.now());
    expect(remaining).toBeNull();
  });

  it("DEFAULT_SLA_CONFIGS has expected states", () => {
    expect(DEFAULT_SLA_CONFIGS.NEEDS_CLEANING).toBeDefined();
    expect(DEFAULT_SLA_CONFIGS.CLEANING).toBeDefined();
    expect(DEFAULT_SLA_CONFIGS.QC).toBeDefined();
    expect(DEFAULT_SLA_CONFIGS.READY).toBeUndefined();
  });
});
