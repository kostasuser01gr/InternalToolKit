import { describe, expect, it } from "vitest";

import {
  isValidTransition,
  allowedTransitions,
  pipelineStageIndex,
  canSignoffQc,
  computeSlaDeadline,
  isSlaBreached,
  slaMinutesRemaining,
  DEFAULT_SLA_CONFIGS,
  PIPELINE_STAGES,
} from "@/lib/fleet-pipeline";
import type { VehicleStatus } from "@prisma/client";

describe("fleet pipeline state transitions", () => {
  it("allows RETURNED → NEEDS_CLEANING", () => {
    expect(isValidTransition("RETURNED" as VehicleStatus, "NEEDS_CLEANING" as VehicleStatus)).toBe(true);
  });

  it("allows NEEDS_CLEANING → CLEANING", () => {
    expect(isValidTransition("NEEDS_CLEANING" as VehicleStatus, "CLEANING" as VehicleStatus)).toBe(true);
  });

  it("allows CLEANING → QC_PENDING", () => {
    expect(isValidTransition("CLEANING" as VehicleStatus, "QC_PENDING" as VehicleStatus)).toBe(true);
  });

  it("allows QC_PENDING → READY", () => {
    expect(isValidTransition("QC_PENDING" as VehicleStatus, "READY" as VehicleStatus)).toBe(true);
  });

  it("allows QC_PENDING → NEEDS_CLEANING (QC fail → reclean)", () => {
    expect(isValidTransition("QC_PENDING" as VehicleStatus, "NEEDS_CLEANING" as VehicleStatus)).toBe(true);
  });

  it("rejects RETURNED → READY (skip steps)", () => {
    expect(isValidTransition("RETURNED" as VehicleStatus, "READY" as VehicleStatus)).toBe(false);
  });

  it("rejects READY → QC_PENDING (backward without re-entry)", () => {
    expect(isValidTransition("READY" as VehicleStatus, "QC_PENDING" as VehicleStatus)).toBe(false);
  });

  it("rejects same-state transition", () => {
    expect(isValidTransition("CLEANING" as VehicleStatus, "CLEANING" as VehicleStatus)).toBe(false);
  });

  it("allows any pipeline state → OUT_OF_SERVICE", () => {
    const states: VehicleStatus[] = ["RETURNED", "NEEDS_CLEANING", "CLEANING", "QC_PENDING", "READY"] as VehicleStatus[];
    for (const s of states) {
      expect(isValidTransition(s, "OUT_OF_SERVICE" as VehicleStatus)).toBe(true);
    }
  });

  it("allows IN_SERVICE → RETURNED", () => {
    expect(isValidTransition("IN_SERVICE" as VehicleStatus, "RETURNED" as VehicleStatus)).toBe(true);
  });

  it("allowedTransitions returns correct set for CLEANING", () => {
    const allowed = allowedTransitions("CLEANING" as VehicleStatus);
    expect(allowed).toContain("QC_PENDING");
    expect(allowed).toContain("OUT_OF_SERVICE");
    expect(allowed).not.toContain("READY");
    expect(allowed).not.toContain("RETURNED");
  });
});

describe("pipeline stage index", () => {
  it("returns correct index for pipeline stages", () => {
    expect(pipelineStageIndex("RETURNED" as VehicleStatus)).toBe(0);
    expect(pipelineStageIndex("NEEDS_CLEANING" as VehicleStatus)).toBe(1);
    expect(pipelineStageIndex("READY" as VehicleStatus)).toBe(4);
  });

  it("returns -1 for side branches", () => {
    expect(pipelineStageIndex("OUT_OF_SERVICE" as VehicleStatus)).toBe(-1);
    expect(pipelineStageIndex("IN_SERVICE" as VehicleStatus)).toBe(-1);
  });

  it("PIPELINE_STAGES has 5 stages", () => {
    expect(PIPELINE_STAGES).toHaveLength(5);
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

describe("SLA helpers", () => {
  it("computeSlaDeadline returns deadline for CLEANING (45 min)", () => {
    const from = new Date("2025-01-15T10:00:00Z");
    const deadline = computeSlaDeadline("CLEANING" as VehicleStatus, from);
    expect(deadline).toEqual(new Date("2025-01-15T10:45:00Z"));
  });

  it("computeSlaDeadline returns null for READY (no SLA)", () => {
    expect(computeSlaDeadline("READY" as VehicleStatus)).toBeNull();
  });

  it("does not breach SLA when within time limit", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:20:00Z").getTime();
    expect(isSlaBreached("CLEANING" as VehicleStatus, enteredAt, now)).toBe(false);
  });

  it("breaches SLA when over time limit", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:50:00Z").getTime();
    expect(isSlaBreached("CLEANING" as VehicleStatus, enteredAt, now)).toBe(true);
  });

  it("returns false for states with no SLA config", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-02T10:00:00Z").getTime();
    expect(isSlaBreached("READY" as VehicleStatus, enteredAt, now)).toBe(false);
  });

  it("accepts ISO string for enteredAt", () => {
    const now = new Date("2026-01-01T11:00:00Z").getTime();
    expect(isSlaBreached("CLEANING" as VehicleStatus, "2026-01-01T10:00:00Z", now)).toBe(true);
  });

  it("respects custom SLA overrides", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:10:00Z").getTime();
    const overrides = { CLEANING: { maxMinutes: 5 } };
    expect(isSlaBreached("CLEANING" as VehicleStatus, enteredAt, now, overrides)).toBe(true);
  });

  it("slaMinutesRemaining returns correct value", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:30:00Z").getTime();
    expect(slaMinutesRemaining("CLEANING" as VehicleStatus, enteredAt, now)).toBe(15);
  });

  it("slaMinutesRemaining returns 0 when breached", () => {
    const enteredAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T11:00:00Z").getTime();
    expect(slaMinutesRemaining("CLEANING" as VehicleStatus, enteredAt, now)).toBe(0);
  });

  it("slaMinutesRemaining returns null for states without SLA", () => {
    expect(slaMinutesRemaining("READY" as VehicleStatus, new Date(), Date.now())).toBeNull();
  });

  it("DEFAULT_SLA_CONFIGS has expected states", () => {
    expect(DEFAULT_SLA_CONFIGS.NEEDS_CLEANING).toBeDefined();
    expect(DEFAULT_SLA_CONFIGS.CLEANING).toBeDefined();
    expect(DEFAULT_SLA_CONFIGS.QC_PENDING).toBeDefined();
    expect(DEFAULT_SLA_CONFIGS.READY).toBeUndefined();
  });
});
