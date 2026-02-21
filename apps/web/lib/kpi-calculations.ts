/**
 * KPI / dashboard calculation helpers.
 * All functions are pure and work on pre-fetched data arrays.
 */

export interface WashTaskRecord {
  id: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  vehicleId: string;
  exteriorDone: boolean;
  interiorDone: boolean;
  vacuumDone: boolean;
}

export interface VehicleRecord {
  id: string;
  status: string;
  plateNumber: string;
}

export interface ShiftRecord {
  id: string;
  assignedUserId: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
}

/** Count tasks by status. */
export function countTasksByStatus(tasks: WashTaskRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return counts;
}

/** Average turnaround time in minutes (from created → status DONE). */
export function avgTurnaroundMinutes(tasks: WashTaskRecord[]): number | null {
  const done = tasks.filter((t) => t.status === "DONE" && t.updatedAt);
  if (done.length === 0) return null;

  let total = 0;
  for (const t of done) {
    const created = new Date(t.createdAt).getTime();
    const updated = new Date(t.updatedAt!).getTime();
    total += updated - created;
  }

  return total / done.length / 60_000;
}

/** Fleet readiness rate (% of vehicles in READY status). */
export function fleetReadinessRate(vehicles: VehicleRecord[]): number {
  if (vehicles.length === 0) return 0;
  const ready = vehicles.filter((v) => v.status === "READY").length;
  return (ready / vehicles.length) * 100;
}

/** Data quality score (0–100). Deducts for missing plates, statuses, etc. */
export function dataQualityScore(
  vehicles: VehicleRecord[],
  tasks: WashTaskRecord[],
): number {
  if (vehicles.length === 0 && tasks.length === 0) return 100;

  let total = 0;
  let issues = 0;

  for (const v of vehicles) {
    total++;
    if (!v.plateNumber || v.plateNumber.trim().length === 0) issues++;
    if (!v.status) issues++;
  }

  for (const t of tasks) {
    total++;
    if (!t.vehicleId) issues++;
    if (!t.status) issues++;
  }

  if (total === 0) return 100;
  return Math.round(((total - issues) / total) * 100);
}

/** Generate CSV rows for a daily wash register. */
export function dailyRegisterCsv(
  tasks: WashTaskRecord[],
  vehicleMap: Map<string, string>, // vehicleId → plateNumber
): string {
  const header = "TaskID,Plate,Status,Exterior,Interior,Vacuum,CreatedAt";
  const rows = tasks.map((t) => {
    const plate = vehicleMap.get(t.vehicleId) ?? t.vehicleId;
    const created = new Date(t.createdAt).toISOString();
    return `${t.id},${plate},${t.status},${t.exteriorDone},${t.interiorDone},${t.vacuumDone},${created}`;
  });
  return [header, ...rows].join("\n");
}

/** Staffing coverage: number of employees assigned per hour slot for a day. */
export function staffingCoverageByHour(
  shifts: ShiftRecord[],
): { hour: number; count: number }[] {
  const coverage = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const s of shifts) {
    if (!s.assignedUserId) continue;
    const start = new Date(s.startsAt);
    const end = new Date(s.endsAt);
    const startH = start.getHours();
    const endH = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
    for (let h = startH; h < Math.min(endH, 24); h++) {
      coverage[h]!.count++;
    }
  }
  return coverage;
}
