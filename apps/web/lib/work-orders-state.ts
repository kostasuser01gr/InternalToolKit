import type { WorkOrderStatus } from "@prisma/client";

const allowedTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "BLOCKED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "DONE", "CANCELLED"],
  BLOCKED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export function canTransitionWorkOrder(
  current: WorkOrderStatus,
  next: WorkOrderStatus,
) {
  if (current === next) {
    return true;
  }

  return allowedTransitions[current].includes(next);
}
