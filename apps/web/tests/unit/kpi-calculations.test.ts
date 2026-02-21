import { describe, expect, it } from "vitest";

import {
  countTasksByStatus,
  avgTurnaroundMinutes,
  fleetReadinessRate,
  dataQualityScore,
  dailyRegisterCsv,
  staffingCoverageByHour,
  type WashTaskRecord,
  type VehicleRecord,
  type ShiftRecord,
} from "@/lib/kpi-calculations";

describe("countTasksByStatus", () => {
  it("counts tasks grouped by status", () => {
    const tasks: WashTaskRecord[] = [
      { id: "1", status: "TODO", createdAt: new Date(), vehicleId: "v1", exteriorDone: false, interiorDone: false, vacuumDone: false },
      { id: "2", status: "DONE", createdAt: new Date(), vehicleId: "v2", exteriorDone: true, interiorDone: true, vacuumDone: true },
      { id: "3", status: "TODO", createdAt: new Date(), vehicleId: "v3", exteriorDone: false, interiorDone: false, vacuumDone: false },
    ];
    const counts = countTasksByStatus(tasks);
    expect(counts.TODO).toBe(2);
    expect(counts.DONE).toBe(1);
  });

  it("returns empty object for no tasks", () => {
    expect(countTasksByStatus([])).toEqual({});
  });
});

describe("avgTurnaroundMinutes", () => {
  it("calculates average turnaround for done tasks", () => {
    const tasks: WashTaskRecord[] = [
      { id: "1", status: "DONE", createdAt: "2026-01-01T10:00:00Z", updatedAt: "2026-01-01T10:30:00Z", vehicleId: "v1", exteriorDone: true, interiorDone: true, vacuumDone: true },
      { id: "2", status: "DONE", createdAt: "2026-01-01T11:00:00Z", updatedAt: "2026-01-01T12:00:00Z", vehicleId: "v2", exteriorDone: true, interiorDone: true, vacuumDone: true },
    ];
    const avg = avgTurnaroundMinutes(tasks);
    expect(avg).toBe(45); // (30 + 60) / 2
  });

  it("returns null when no done tasks", () => {
    const tasks: WashTaskRecord[] = [
      { id: "1", status: "TODO", createdAt: new Date(), vehicleId: "v1", exteriorDone: false, interiorDone: false, vacuumDone: false },
    ];
    expect(avgTurnaroundMinutes(tasks)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(avgTurnaroundMinutes([])).toBeNull();
  });
});

describe("fleetReadinessRate", () => {
  it("calculates percentage of ready vehicles", () => {
    const vehicles: VehicleRecord[] = [
      { id: "v1", status: "READY", plateNumber: "ABC" },
      { id: "v2", status: "NEEDS_CLEANING", plateNumber: "DEF" },
      { id: "v3", status: "READY", plateNumber: "GHI" },
      { id: "v4", status: "IN_SERVICE", plateNumber: "JKL" },
    ];
    expect(fleetReadinessRate(vehicles)).toBe(50);
  });

  it("returns 0 for empty fleet", () => {
    expect(fleetReadinessRate([])).toBe(0);
  });

  it("returns 100 when all ready", () => {
    const vehicles: VehicleRecord[] = [
      { id: "v1", status: "READY", plateNumber: "A" },
      { id: "v2", status: "READY", plateNumber: "B" },
    ];
    expect(fleetReadinessRate(vehicles)).toBe(100);
  });
});

describe("dataQualityScore", () => {
  it("returns 100 for perfect data", () => {
    const vehicles: VehicleRecord[] = [
      { id: "v1", status: "READY", plateNumber: "ABC123" },
    ];
    const tasks: WashTaskRecord[] = [
      { id: "t1", status: "DONE", createdAt: new Date(), vehicleId: "v1", exteriorDone: true, interiorDone: true, vacuumDone: true },
    ];
    expect(dataQualityScore(vehicles, tasks)).toBe(100);
  });

  it("returns 100 for empty data", () => {
    expect(dataQualityScore([], [])).toBe(100);
  });

  it("deducts for missing plate numbers", () => {
    const vehicles: VehicleRecord[] = [
      { id: "v1", status: "READY", plateNumber: "" },
      { id: "v2", status: "READY", plateNumber: "ABC" },
    ];
    const score = dataQualityScore(vehicles, []);
    expect(score).toBeLessThan(100);
    expect(score).toBe(50); // 1 issue out of 2
  });
});

describe("dailyRegisterCsv", () => {
  it("generates CSV with header and rows", () => {
    const tasks: WashTaskRecord[] = [
      { id: "t1", status: "DONE", createdAt: "2026-01-01T10:00:00.000Z", vehicleId: "v1", exteriorDone: true, interiorDone: true, vacuumDone: false },
    ];
    const vehicleMap = new Map([["v1", "ABC123"]]);
    const csv = dailyRegisterCsv(tasks, vehicleMap);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("TaskID,Plate,Status,Exterior,Interior,Vacuum,CreatedAt");
    expect(lines[1]).toContain("t1");
    expect(lines[1]).toContain("ABC123");
    expect(lines[1]).toContain("DONE");
  });

  it("uses vehicleId when plate not in map", () => {
    const tasks: WashTaskRecord[] = [
      { id: "t1", status: "TODO", createdAt: "2026-01-01T10:00:00.000Z", vehicleId: "v-unknown", exteriorDone: false, interiorDone: false, vacuumDone: false },
    ];
    const csv = dailyRegisterCsv(tasks, new Map());
    expect(csv).toContain("v-unknown");
  });
});

describe("staffingCoverageByHour", () => {
  it("returns 24 hour slots", () => {
    const coverage = staffingCoverageByHour([]);
    expect(coverage).toHaveLength(24);
    expect(coverage[0]!.hour).toBe(0);
    expect(coverage[23]!.hour).toBe(23);
  });

  it("counts employees per hour", () => {
    const shifts: ShiftRecord[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T12:00:00Z", status: "PUBLISHED" },
      { id: "s2", assignedUserId: "u2", startsAt: "2026-01-01T10:00:00Z", endsAt: "2026-01-01T14:00:00Z", status: "PUBLISHED" },
    ];
    const coverage = staffingCoverageByHour(shifts);
    expect(coverage[8]!.count).toBe(1);  // u1
    expect(coverage[10]!.count).toBe(2); // u1 + u2
    expect(coverage[12]!.count).toBe(1); // u2
    expect(coverage[14]!.count).toBe(0); // nobody
  });

  it("skips unassigned shifts", () => {
    const shifts: ShiftRecord[] = [
      { id: "s1", assignedUserId: null, startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T12:00:00Z", status: "DRAFT" },
    ];
    const coverage = staffingCoverageByHour(shifts);
    expect(coverage[8]!.count).toBe(0);
  });
});
