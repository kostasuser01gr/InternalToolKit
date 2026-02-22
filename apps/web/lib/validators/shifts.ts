import { ShiftRequestType, ShiftStatus } from "@prisma/client";
import { z } from "zod";

export const createShiftSchema = z
  .object({
    workspaceId: z.string().min(1),
    title: z.string().trim().min(3).max(120),
    assignedUserId: z.string().min(1).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    notes: z.string().trim().max(800).optional(),
    status: z.nativeEnum(ShiftStatus).optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "Shift end time must be after start time.",
    path: ["endsAt"],
  });

export const moveShiftSchema = z.object({
  shiftId: z.string().min(1),
  workspaceId: z.string().min(1),
  targetDateIso: z.string().date(),
});

export const createShiftRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    shiftId: z.string().min(1).optional(),
    type: z.nativeEnum(ShiftRequestType),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    reason: z.string().trim().min(5).max(500),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "Request end time must be after start time.",
    path: ["endsAt"],
  });

export const reviewShiftRequestSchema = z.object({
  workspaceId: z.string().min(1),
  requestId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export const importShiftsCsvSchema = z.object({
  workspaceId: z.string().min(1),
  csvContent: z.string().trim().min(1),
});

export const transitionShiftSchema = z.object({
  workspaceId: z.string().min(1),
  shiftId: z.string().min(1),
  targetStatus: z.nativeEnum(ShiftStatus),
  notes: z.string().trim().max(800).optional(),
});

export const rollbackShiftSchema = z.object({
  workspaceId: z.string().min(1),
  shiftId: z.string().min(1),
});
