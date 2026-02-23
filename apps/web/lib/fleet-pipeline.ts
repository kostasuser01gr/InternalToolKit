/**
 * Fleet turnaround pipeline — state machine + SLA helpers.
 *
 * Vehicle lifecycle (Prisma VehicleStatus enum):
 *   RETURNED → NEEDS_CLEANING → CLEANING → QC_PENDING → READY
 *   Any state may also transition to OUT_OF_SERVICE.
 *   IN_SERVICE vehicles return via RETURNED.
 *
 * FleetPipelineState mirrors VehicleStatus for the new pipeline engine
 * and adds BLOCKED / MAINTENANCE / RENTED.
 */
import type { VehicleStatus, FleetPipelineState } from "@prisma/client";

/** Pipeline stages in display order. */
export const PIPELINE_STAGES: VehicleStatus[] = [
  "RETURNED",
  "NEEDS_CLEANING",
  "CLEANING",
  "QC_PENDING",
  "READY",
] as VehicleStatus[];

// Allowed transitions: from → to[]
const TRANSITION_MAP: Record<string, VehicleStatus[]> = {
  RETURNED: ["NEEDS_CLEANING", "OUT_OF_SERVICE"],
  NEEDS_CLEANING: ["CLEANING", "OUT_OF_SERVICE"],
  CLEANING: ["QC_PENDING", "OUT_OF_SERVICE"],
  QC_PENDING: ["READY", "NEEDS_CLEANING", "OUT_OF_SERVICE"],
  READY: ["IN_SERVICE", "OUT_OF_SERVICE"],
  IN_SERVICE: ["RETURNED", "OUT_OF_SERVICE"],
  OUT_OF_SERVICE: ["RETURNED", "NEEDS_CLEANING"],
};

/** Check whether a transition from `current` to `next` is valid. */
export function isValidTransition(current: VehicleStatus, next: VehicleStatus): boolean {
  if (current === next) return false;
  return (TRANSITION_MAP[current] ?? []).includes(next);
}

/** Return the set of reachable states from `current`. */
export function allowedTransitions(current: VehicleStatus): VehicleStatus[] {
  return TRANSITION_MAP[current] ?? [];
}

/** Index within the main pipeline (−1 if side branch). */
export function pipelineStageIndex(status: VehicleStatus): number {
  return PIPELINE_STAGES.indexOf(status);
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
export const DEFAULT_SLA_CONFIGS: Partial<Record<string, SlaConfig>> = {
  NEEDS_CLEANING: { maxMinutes: 30 },
  CLEANING: { maxMinutes: 45 },
  QC_PENDING: { maxMinutes: 15 },
};

/**
 * Compute a deadline Date for a given pipeline state.
 * Returns null if no SLA applies.
 */
export function computeSlaDeadline(
  status: VehicleStatus,
  from: Date = new Date(),
  overrides?: Partial<Record<string, SlaConfig>>,
): Date | null {
  const config = overrides?.[status] ?? DEFAULT_SLA_CONFIGS[status];
  if (!config) return null;
  return new Date(from.getTime() + config.maxMinutes * 60_000);
}

/**
 * Determine whether a vehicle has breached its SLA.
 */
export function isSlaBreached(
  state: VehicleStatus,
  enteredAt: Date | string,
  nowMs: number = Date.now(),
  overrides?: Partial<Record<string, SlaConfig>>,
): boolean {
  const config = overrides?.[state] ?? DEFAULT_SLA_CONFIGS[state];
  if (!config) return false;
  const enteredMs = typeof enteredAt === "string" ? new Date(enteredAt).getTime() : enteredAt.getTime();
  const elapsed = nowMs - enteredMs;
  return elapsed > config.maxMinutes * 60_000;
}

/**
 * Compute minutes remaining before SLA breach. Returns null if no SLA applies.
 */
export function slaMinutesRemaining(
  state: VehicleStatus,
  enteredAt: Date | string,
  nowMs: number = Date.now(),
  overrides?: Partial<Record<string, SlaConfig>>,
): number | null {
  const config = overrides?.[state] ?? DEFAULT_SLA_CONFIGS[state];
  if (!config) return null;
  const enteredMs = typeof enteredAt === "string" ? new Date(enteredAt).getTime() : enteredAt.getTime();
  const elapsed = nowMs - enteredMs;
  return Math.max(0, config.maxMinutes - elapsed / 60_000);
}

// ─── FleetPipelineState utilities ────────────────────────────────────────────

/** Map FleetPipelineState → allowed next states. */
const FLEET_PIPELINE_TRANSITIONS: Record<string, FleetPipelineState[]> = {
  RETURNED: ["NEEDS_CLEANING", "BLOCKED", "MAINTENANCE", "OUT_OF_SERVICE"],
  NEEDS_CLEANING: ["CLEANING", "BLOCKED", "OUT_OF_SERVICE"],
  CLEANING: ["QC_PENDING", "BLOCKED", "OUT_OF_SERVICE"],
  QC_PENDING: ["READY", "NEEDS_CLEANING", "BLOCKED", "OUT_OF_SERVICE"],
  READY: ["RENTED", "BLOCKED", "MAINTENANCE", "OUT_OF_SERVICE"],
  RENTED: ["RETURNED", "BLOCKED", "OUT_OF_SERVICE"],
  BLOCKED: ["RETURNED", "NEEDS_CLEANING", "CLEANING", "QC_PENDING", "READY", "MAINTENANCE", "OUT_OF_SERVICE"],
  MAINTENANCE: ["RETURNED", "NEEDS_CLEANING", "READY", "OUT_OF_SERVICE"],
  OUT_OF_SERVICE: ["RETURNED", "NEEDS_CLEANING"],
};

export function isValidPipelineTransition(
  current: FleetPipelineState,
  next: FleetPipelineState,
): boolean {
  if (current === next) return false;
  return (FLEET_PIPELINE_TRANSITIONS[current] ?? []).includes(next);
}

export function allowedPipelineTransitions(
  current: FleetPipelineState,
): FleetPipelineState[] {
  return FLEET_PIPELINE_TRANSITIONS[current] ?? [];
}

// ─── Blocker types ───────────────────────────────────────────────────────────

export const BLOCKER_TYPES = [
  "no_key",
  "damage",
  "low_fuel",
  "docs_missing",
  "waiting_parts",
  "other",
] as const;

export type BlockerType = (typeof BLOCKER_TYPES)[number];

// ─── QC checklist template ──────────────────────────────────────────────────

export const QC_CHECKLIST_ITEMS = [
  { id: "exterior_clean", label: "Exterior clean" },
  { id: "interior_clean", label: "Interior clean" },
  { id: "windows_clear", label: "Windows clear" },
  { id: "vacuum_done", label: "Vacuum done" },
  { id: "no_odor", label: "No odor" },
  { id: "fuel_ok", label: "Fuel level OK" },
  { id: "docs_present", label: "Documents present" },
  { id: "key_present", label: "Key present" },
] as const;

export type QcChecklistItemId = (typeof QC_CHECKLIST_ITEMS)[number]["id"];

