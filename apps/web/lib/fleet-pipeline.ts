/**
 * Fleet turnaround pipeline — state machine + SLA helpers.
 *
 * Vehicle lifecycle:
 *   RETURNED → NEEDS_CLEANING → CLEANING → QC → READY
 *   Any state may also transition to BLOCKED or MAINTENANCE.
 */

// Valid vehicle lifecycle states
export const FLEET_STATES = [
  "RETURNED",
  "NEEDS_CLEANING",
  "CLEANING",
  "QC",
  "READY",
  "BLOCKED",
  "MAINTENANCE",
] as const;

export type FleetState = (typeof FLEET_STATES)[number];

// Allowed transitions: from → to[]
const TRANSITION_MAP: Record<FleetState, FleetState[]> = {
  RETURNED: ["NEEDS_CLEANING", "BLOCKED", "MAINTENANCE"],
  NEEDS_CLEANING: ["CLEANING", "BLOCKED", "MAINTENANCE"],
  CLEANING: ["QC", "BLOCKED", "MAINTENANCE"],
  QC: ["READY", "NEEDS_CLEANING", "BLOCKED", "MAINTENANCE"],
  READY: ["RETURNED", "NEEDS_CLEANING", "BLOCKED", "MAINTENANCE"],
  BLOCKED: ["NEEDS_CLEANING", "RETURNED", "MAINTENANCE"],
  MAINTENANCE: ["NEEDS_CLEANING", "RETURNED", "BLOCKED"],
};

/** Check whether a transition from `current` to `next` is valid. */
export function isValidTransition(current: FleetState, next: FleetState): boolean {
  if (current === next) return false;
  return (TRANSITION_MAP[current] ?? []).includes(next);
}

/** Return the set of reachable states from `current`. */
export function allowedTransitions(current: FleetState): FleetState[] {
  return TRANSITION_MAP[current] ?? [];
}

// QC reason codes
export const QC_FAIL_REASONS = [
  "SPOTS_ON_BODY",
  "INTERIOR_DIRTY",
  "WINDOWS_STREAKED",
  "VACUUM_INCOMPLETE",
  "ODOR",
  "OTHER",
] as const;

export type QcFailReason = (typeof QC_FAIL_REASONS)[number];

/** Roles that may perform QC signoff. */
export const QC_SIGNOFF_ROLES = ["ADMIN", "EDITOR"] as const;

/** Check if a role can do QC signoff. */
export function canSignoffQc(role: string): boolean {
  return (QC_SIGNOFF_ROLES as readonly string[]).includes(role);
}

// SLA helpers
export interface SlaConfig {
  /** Max minutes a vehicle may stay in a state before alert fires. */
  maxMinutes: number;
}

/** Default SLA configs per state (only states that have SLAs). */
export const DEFAULT_SLA_CONFIGS: Partial<Record<FleetState, SlaConfig>> = {
  NEEDS_CLEANING: { maxMinutes: 30 },
  CLEANING: { maxMinutes: 45 },
  QC: { maxMinutes: 15 },
};

/**
 * Determine whether a vehicle has breached its SLA.
 * @param state     Current fleet state
 * @param enteredAt When the vehicle entered this state (Date or ISO string)
 * @param nowMs     Current time in ms (defaults to Date.now())
 * @param overrides Optional per-state SLA config overrides
 */
export function isSlaBreached(
  state: FleetState,
  enteredAt: Date | string,
  nowMs: number = Date.now(),
  overrides?: Partial<Record<FleetState, SlaConfig>>,
): boolean {
  const config = overrides?.[state] ?? DEFAULT_SLA_CONFIGS[state];
  if (!config) return false; // no SLA for this state
  const enteredMs = typeof enteredAt === "string" ? new Date(enteredAt).getTime() : enteredAt.getTime();
  const elapsed = nowMs - enteredMs;
  return elapsed > config.maxMinutes * 60_000;
}

/**
 * Compute minutes remaining before SLA breach. Returns null if no SLA applies.
 */
export function slaMinutesRemaining(
  state: FleetState,
  enteredAt: Date | string,
  nowMs: number = Date.now(),
  overrides?: Partial<Record<FleetState, SlaConfig>>,
): number | null {
  const config = overrides?.[state] ?? DEFAULT_SLA_CONFIGS[state];
  if (!config) return null;
  const enteredMs = typeof enteredAt === "string" ? new Date(enteredAt).getTime() : enteredAt.getTime();
  const elapsed = nowMs - enteredMs;
  return Math.max(0, config.maxMinutes - elapsed / 60_000);
}
