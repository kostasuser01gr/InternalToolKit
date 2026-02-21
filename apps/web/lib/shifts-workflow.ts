/**
 * Shifts operational workflow helpers.
 *
 * Schedule lifecycle: DRAFT → REVIEW → PUBLISHED
 * After PUBLISHED, edits require coordinator override.
 */

export const SCHEDULE_STATES = ["DRAFT", "REVIEW", "PUBLISHED"] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

const SCHEDULE_TRANSITIONS: Record<ScheduleState, ScheduleState[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "PUBLISHED"],
  PUBLISHED: [], // locked — needs override
};

export function isValidScheduleTransition(
  current: ScheduleState,
  next: ScheduleState,
): boolean {
  if (current === next) return false;
  return SCHEDULE_TRANSITIONS[current].includes(next);
}

export function allowedScheduleTransitions(current: ScheduleState): ScheduleState[] {
  return SCHEDULE_TRANSITIONS[current];
}

/**
 * Check if a schedule is editable (only DRAFT is freely editable).
 */
export function isScheduleEditable(state: ScheduleState): boolean {
  return state === "DRAFT";
}

/**
 * Check if a schedule is locked (PUBLISHED).
 */
export function isScheduleLocked(state: ScheduleState): boolean {
  return state === "PUBLISHED";
}

// Swap request lifecycle
export const SWAP_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

/**
 * Roles that may approve swap requests.
 */
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

/**
 * Detect overlapping shifts for a specific user.
 * Returns pairs of shift IDs that overlap.
 */
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

/**
 * Detect if a user would exceed a maximum number of hours in a day.
 */
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
