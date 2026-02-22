/**
 * Shifts operational workflow helpers.
 *
 * Schedule lifecycle: DRAFT → REVIEW → PUBLISHED → LOCKED
 * After LOCKED, edits require coordinator override + rollback.
 */
import type { ShiftStatus } from "@prisma/client";

export const SCHEDULE_STATES: ShiftStatus[] = [
  "DRAFT",
  "REVIEW",
  "PUBLISHED",
  "LOCKED",
] as ShiftStatus[];

const SCHEDULE_TRANSITIONS: Record<string, ShiftStatus[]> = {
  DRAFT: ["REVIEW", "CANCELLED"],
  REVIEW: ["DRAFT", "PUBLISHED", "CANCELLED"],
  PUBLISHED: ["LOCKED", "REVIEW", "COMPLETED", "CANCELLED"],
  LOCKED: [], // requires coordinator override
  COMPLETED: [],
  CANCELLED: ["DRAFT"],
};

export function isValidScheduleTransition(
  current: ShiftStatus,
  next: ShiftStatus,
): boolean {
  if (current === next) return false;
  return (SCHEDULE_TRANSITIONS[current] ?? []).includes(next);
}

export function allowedScheduleTransitions(current: ShiftStatus): ShiftStatus[] {
  return SCHEDULE_TRANSITIONS[current] ?? [];
}

/** Only DRAFT is freely editable. */
export function isScheduleEditable(state: ShiftStatus): boolean {
  return state === "DRAFT";
}

/** LOCKED and COMPLETED are locked states. */
export function isScheduleLocked(state: ShiftStatus): boolean {
  return state === "LOCKED" || state === "COMPLETED";
}

/** PUBLISHED or LOCKED — visible to employees. */
export function isScheduleVisible(state: ShiftStatus): boolean {
  return state === "PUBLISHED" || state === "LOCKED";
}

// Swap request lifecycle
export const SWAP_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

/** Roles that may approve swap requests. */
export const SWAP_APPROVER_ROLES = ["ADMIN", "EDITOR"] as const;

export function canApproveSwap(role: string): boolean {
  return (SWAP_APPROVER_ROLES as readonly string[]).includes(role);
}

// Constraint / conflict detection

export interface ShiftSlot {
  id: string;
  assignedUserId: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
}

/** Detect overlapping shifts for a specific user. */
export function detectOverlaps(shifts: ShiftSlot[]): [string, string][] {
  const overlaps: [string, string][] = [];
  const sorted = [...shifts]
    .filter((s) => s.assignedUserId != null)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (a.assignedUserId !== b.assignedUserId) continue;
      const aEnd = new Date(a.endsAt).getTime();
      const bStart = new Date(b.startsAt).getTime();
      if (bStart < aEnd) {
        overlaps.push([a.id, b.id]);
      }
    }
  }

  return overlaps;
}

/** Detect if a user would exceed a maximum number of hours in a day. */
export function detectOvertimeViolations(
  shifts: ShiftSlot[],
  maxHoursPerDay: number = 10,
): { userId: string; date: string; totalHours: number }[] {
  const byUserDate = new Map<string, number>();

  for (const s of shifts) {
    if (!s.assignedUserId) continue;
    const start = new Date(s.startsAt);
    const end = new Date(s.endsAt);
    const dateKey = start.toISOString().slice(0, 10);
    const key = `${s.assignedUserId}::${dateKey}`;
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    byUserDate.set(key, (byUserDate.get(key) ?? 0) + hours);
  }

  const violations: { userId: string; date: string; totalHours: number }[] = [];
  for (const [key, totalHours] of byUserDate) {
    if (totalHours > maxHoursPerDay) {
      const [userId, date] = key.split("::");
      violations.push({ userId: userId!, date: date!, totalHours });
    }
  }

  return violations;
}

/** Create a snapshot of shift data for rollback. */
export function createShiftSnapshot(shift: {
  title: string;
  assignedUserId: string | null;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  status: string;
}): string {
  return JSON.stringify({
    title: shift.title,
    assignedUserId: shift.assignedUserId,
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    notes: shift.notes,
    status: shift.status,
    snapshotAt: new Date().toISOString(),
  });
}
