import { describe, expect, it } from "vitest";

import {
  isValidScheduleTransition,
  allowedScheduleTransitions,
  isScheduleEditable,
  isScheduleLocked,
  canApproveSwap,
  detectOverlaps,
  detectOvertimeViolations,
  type ShiftSlot,
} from "@/lib/shifts-workflow";

describe("schedule publish/lock workflow", () => {
  it("allows DRAFT → REVIEW", () => {
    expect(isValidScheduleTransition("DRAFT", "REVIEW")).toBe(true);
  });

  it("allows REVIEW → PUBLISHED", () => {
    expect(isValidScheduleTransition("REVIEW", "PUBLISHED")).toBe(true);
  });

  it("allows REVIEW → DRAFT (send back)", () => {
    expect(isValidScheduleTransition("REVIEW", "DRAFT")).toBe(true);
  });

  it("rejects PUBLISHED → any (locked)", () => {
    expect(isValidScheduleTransition("PUBLISHED", "DRAFT")).toBe(false);
    expect(isValidScheduleTransition("PUBLISHED", "REVIEW")).toBe(false);
  });

  it("rejects DRAFT → PUBLISHED (must go through REVIEW)", () => {
    expect(isValidScheduleTransition("DRAFT", "PUBLISHED")).toBe(false);
  });

  it("rejects same-state transition", () => {
    expect(isValidScheduleTransition("DRAFT", "DRAFT")).toBe(false);
  });

  it("allowedScheduleTransitions for REVIEW returns DRAFT and PUBLISHED", () => {
    const allowed = allowedScheduleTransitions("REVIEW");
    expect(allowed).toContain("DRAFT");
    expect(allowed).toContain("PUBLISHED");
  });

  it("allowedScheduleTransitions for PUBLISHED returns empty", () => {
    expect(allowedScheduleTransitions("PUBLISHED")).toHaveLength(0);
  });
});

describe("schedule editable/locked checks", () => {
  it("DRAFT is editable", () => {
    expect(isScheduleEditable("DRAFT")).toBe(true);
  });

  it("REVIEW is not editable", () => {
    expect(isScheduleEditable("REVIEW")).toBe(false);
  });

  it("PUBLISHED is not editable", () => {
    expect(isScheduleEditable("PUBLISHED")).toBe(false);
  });

  it("PUBLISHED is locked", () => {
    expect(isScheduleLocked("PUBLISHED")).toBe(true);
  });

  it("DRAFT is not locked", () => {
    expect(isScheduleLocked("DRAFT")).toBe(false);
  });
});

describe("swap request approval", () => {
  it("ADMIN can approve swaps", () => {
    expect(canApproveSwap("ADMIN")).toBe(true);
  });

  it("EDITOR can approve swaps", () => {
    expect(canApproveSwap("EDITOR")).toBe(true);
  });

  it("EMPLOYEE cannot approve swaps", () => {
    expect(canApproveSwap("EMPLOYEE")).toBe(false);
  });

  it("WASHER cannot approve swaps", () => {
    expect(canApproveSwap("WASHER")).toBe(false);
  });
});

describe("shift conflict detection - overlaps", () => {
  it("detects two overlapping shifts for the same user", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" },
      { id: "s2", assignedUserId: "u1", startsAt: "2026-01-01T14:00:00Z", endsAt: "2026-01-01T22:00:00Z" },
    ];
    const overlaps = detectOverlaps(shifts);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toEqual(["s1", "s2"]);
  });

  it("does not flag non-overlapping shifts for same user", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" },
      { id: "s2", assignedUserId: "u1", startsAt: "2026-01-01T16:00:00Z", endsAt: "2026-01-01T22:00:00Z" },
    ];
    expect(detectOverlaps(shifts)).toHaveLength(0);
  });

  it("does not flag overlapping shifts for different users", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" },
      { id: "s2", assignedUserId: "u2", startsAt: "2026-01-01T14:00:00Z", endsAt: "2026-01-01T22:00:00Z" },
    ];
    expect(detectOverlaps(shifts)).toHaveLength(0);
  });

  it("skips shifts with null assignedUserId", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: null, startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" },
      { id: "s2", assignedUserId: null, startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" },
    ];
    expect(detectOverlaps(shifts)).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(detectOverlaps([])).toHaveLength(0);
  });
});

describe("shift conflict detection - overtime", () => {
  it("detects overtime when user exceeds max hours per day", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T06:00:00Z", endsAt: "2026-01-01T14:00:00Z" }, // 8h
      { id: "s2", assignedUserId: "u1", startsAt: "2026-01-01T15:00:00Z", endsAt: "2026-01-01T20:00:00Z" }, // 5h = 13h total
    ];
    const violations = detectOvertimeViolations(shifts, 10);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.userId).toBe("u1");
    expect(violations[0]!.totalHours).toBe(13);
  });

  it("does not flag when within limit", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" }, // 8h
    ];
    expect(detectOvertimeViolations(shifts, 10)).toHaveLength(0);
  });

  it("uses default 10h limit", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T11:00:00Z" }, // 11h
    ];
    expect(detectOvertimeViolations(shifts)).toHaveLength(1);
  });
});
