import { describe, expect, it } from "vitest";
import type { ShiftStatus } from "@prisma/client";

import {
  SCHEDULE_STATES,
  isValidScheduleTransition,
  allowedScheduleTransitions,
  isScheduleEditable,
  isScheduleLocked,
  isScheduleVisible,
  canApproveSwap,
  detectOverlaps,
  detectOvertimeViolations,
  createShiftSnapshot,
  type ShiftSlot,
} from "@/lib/shifts-workflow";

describe("schedule publish/lock workflow v2", () => {
  it("has 4 ordered states", () => {
    expect(SCHEDULE_STATES).toEqual(["DRAFT", "REVIEW", "PUBLISHED", "LOCKED"]);
  });

  it("allows DRAFT → REVIEW", () => {
    expect(isValidScheduleTransition("DRAFT" as ShiftStatus, "REVIEW" as ShiftStatus)).toBe(true);
  });

  it("allows REVIEW → PUBLISHED", () => {
    expect(isValidScheduleTransition("REVIEW" as ShiftStatus, "PUBLISHED" as ShiftStatus)).toBe(true);
  });

  it("allows PUBLISHED → LOCKED", () => {
    expect(isValidScheduleTransition("PUBLISHED" as ShiftStatus, "LOCKED" as ShiftStatus)).toBe(true);
  });

  it("allows REVIEW → DRAFT (send back)", () => {
    expect(isValidScheduleTransition("REVIEW" as ShiftStatus, "DRAFT" as ShiftStatus)).toBe(true);
  });

  it("allows PUBLISHED → REVIEW (reopen)", () => {
    expect(isValidScheduleTransition("PUBLISHED" as ShiftStatus, "REVIEW" as ShiftStatus)).toBe(true);
  });

  it("rejects LOCKED → any (requires override)", () => {
    expect(isValidScheduleTransition("LOCKED" as ShiftStatus, "DRAFT" as ShiftStatus)).toBe(false);
    expect(isValidScheduleTransition("LOCKED" as ShiftStatus, "REVIEW" as ShiftStatus)).toBe(false);
    expect(isValidScheduleTransition("LOCKED" as ShiftStatus, "PUBLISHED" as ShiftStatus)).toBe(false);
  });

  it("rejects DRAFT → PUBLISHED (must go through REVIEW)", () => {
    expect(isValidScheduleTransition("DRAFT" as ShiftStatus, "PUBLISHED" as ShiftStatus)).toBe(false);
  });

  it("rejects same-state transition", () => {
    expect(isValidScheduleTransition("DRAFT" as ShiftStatus, "DRAFT" as ShiftStatus)).toBe(false);
  });

  it("allows DRAFT → CANCELLED", () => {
    expect(isValidScheduleTransition("DRAFT" as ShiftStatus, "CANCELLED" as ShiftStatus)).toBe(true);
  });

  it("allows CANCELLED → DRAFT (reactivate)", () => {
    expect(isValidScheduleTransition("CANCELLED" as ShiftStatus, "DRAFT" as ShiftStatus)).toBe(true);
  });

  it("allowedScheduleTransitions for REVIEW returns DRAFT and PUBLISHED", () => {
    const allowed = allowedScheduleTransitions("REVIEW" as ShiftStatus);
    expect(allowed).toContain("DRAFT");
    expect(allowed).toContain("PUBLISHED");
  });

  it("allowedScheduleTransitions for LOCKED returns empty", () => {
    expect(allowedScheduleTransitions("LOCKED" as ShiftStatus)).toHaveLength(0);
  });

  it("allowedScheduleTransitions for PUBLISHED includes LOCKED", () => {
    const allowed = allowedScheduleTransitions("PUBLISHED" as ShiftStatus);
    expect(allowed).toContain("LOCKED");
  });
});

describe("schedule editable/locked/visible checks", () => {
  it("DRAFT is editable", () => {
    expect(isScheduleEditable("DRAFT" as ShiftStatus)).toBe(true);
  });

  it("REVIEW is not editable", () => {
    expect(isScheduleEditable("REVIEW" as ShiftStatus)).toBe(false);
  });

  it("PUBLISHED is not editable", () => {
    expect(isScheduleEditable("PUBLISHED" as ShiftStatus)).toBe(false);
  });

  it("LOCKED is locked", () => {
    expect(isScheduleLocked("LOCKED" as ShiftStatus)).toBe(true);
  });

  it("COMPLETED is locked", () => {
    expect(isScheduleLocked("COMPLETED" as ShiftStatus)).toBe(true);
  });

  it("PUBLISHED is not locked", () => {
    expect(isScheduleLocked("PUBLISHED" as ShiftStatus)).toBe(false);
  });

  it("DRAFT is not locked", () => {
    expect(isScheduleLocked("DRAFT" as ShiftStatus)).toBe(false);
  });

  it("PUBLISHED is visible", () => {
    expect(isScheduleVisible("PUBLISHED" as ShiftStatus)).toBe(true);
  });

  it("LOCKED is visible", () => {
    expect(isScheduleVisible("LOCKED" as ShiftStatus)).toBe(true);
  });

  it("DRAFT is not visible", () => {
    expect(isScheduleVisible("DRAFT" as ShiftStatus)).toBe(false);
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
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T06:00:00Z", endsAt: "2026-01-01T14:00:00Z" },
      { id: "s2", assignedUserId: "u1", startsAt: "2026-01-01T15:00:00Z", endsAt: "2026-01-01T20:00:00Z" },
    ];
    const violations = detectOvertimeViolations(shifts, 10);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.userId).toBe("u1");
    expect(violations[0]!.totalHours).toBe(13);
  });

  it("does not flag when within limit", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T08:00:00Z", endsAt: "2026-01-01T16:00:00Z" },
    ];
    expect(detectOvertimeViolations(shifts, 10)).toHaveLength(0);
  });

  it("uses default 10h limit", () => {
    const shifts: ShiftSlot[] = [
      { id: "s1", assignedUserId: "u1", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T11:00:00Z" },
    ];
    expect(detectOvertimeViolations(shifts)).toHaveLength(1);
  });
});

describe("createShiftSnapshot", () => {
  it("creates a JSON snapshot with all fields", () => {
    const shift = {
      title: "Morning shift",
      assignedUserId: "u1",
      startsAt: new Date("2025-01-15T08:00:00Z"),
      endsAt: new Date("2025-01-15T16:00:00Z"),
      notes: "Test notes",
      status: "PUBLISHED",
    };
    const json = createShiftSnapshot(shift);
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe("Morning shift");
    expect(parsed.assignedUserId).toBe("u1");
    expect(parsed.startsAt).toBe("2025-01-15T08:00:00.000Z");
    expect(parsed.snapshotAt).toBeDefined();
  });

  it("handles null assignedUserId", () => {
    const shift = {
      title: "Open shift",
      assignedUserId: null,
      startsAt: new Date("2025-01-15T08:00:00Z"),
      endsAt: new Date("2025-01-15T16:00:00Z"),
      notes: null,
      status: "DRAFT",
    };
    const parsed = JSON.parse(createShiftSnapshot(shift));
    expect(parsed.assignedUserId).toBeNull();
    expect(parsed.notes).toBeNull();
  });
});
