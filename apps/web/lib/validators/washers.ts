import { WasherTaskStatus } from "@prisma/client";
import { z } from "zod";

export const createWasherTaskSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1),
  washerUserId: z.string().min(1).optional(),
  status: z.nativeEnum(WasherTaskStatus),
  exteriorDone: z.boolean().optional(),
  interiorDone: z.boolean().optional(),
  vacuumDone: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
  voiceTranscript: z.string().trim().max(1000).optional(),
});

export const updateWasherTaskSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.nativeEnum(WasherTaskStatus),
  exteriorDone: z.boolean(),
  interiorDone: z.boolean(),
  vacuumDone: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
  voiceTranscript: z.string().trim().max(1000).optional(),
});
