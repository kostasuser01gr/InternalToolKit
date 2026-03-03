import { z } from "zod";

export const workOrderLineSchema = z.object({
  lineType: z.enum(["LABOR", "PART"]),
  description: z.string().trim().min(2).max(300),
  quantity: z.coerce.number().min(0).max(100_000),
  unitCost: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(300).optional(),
});

export const createWorkOrderSchema = z.object({
  workspaceId: z.string().min(1),
  stationId: z.string().min(1).optional(),
  vehicleId: z.string().min(1).optional(),
  incidentId: z.string().min(1).optional(),
  assignedToUserId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  lines: z.array(workOrderLineSchema).max(100).default([]),
});

export const updateWorkOrderSchema = z.object({
  workspaceId: z.string().min(1),
  workOrderId: z.string().min(1),
  stationId: z.string().min(1).optional(),
  vehicleId: z.string().min(1).optional(),
  incidentId: z.string().min(1).optional(),
  assignedToUserId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
});

export const transitionWorkOrderSchema = z.object({
  workspaceId: z.string().min(1),
  workOrderId: z.string().min(1),
  nextStatus: z.enum([
    "OPEN",
    "ASSIGNED",
    "IN_PROGRESS",
    "BLOCKED",
    "DONE",
    "CANCELLED",
  ]),
  note: z.string().trim().max(400).optional(),
});
