import { AttendanceType, SkillLevel, TrainingStatus } from "@prisma/client";
import { z } from "zod";

export const recordAttendanceSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.nativeEnum(AttendanceType),
  notes: z.string().trim().max(500).optional(),
  deviceId: z.string().max(100).optional(),
});

export const createSkillSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});

export const assignSkillSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  skillId: z.string().min(1),
  level: z.nativeEnum(SkillLevel),
  expiresAt: z.string().datetime().optional(),
});

export const createTrainingSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(1000).optional(),
  durationMin: z.coerce.number().int().min(1).max(10000).optional(),
});

export const updateTrainingRecordSchema = z.object({
  workspaceId: z.string().min(1),
  trainingId: z.string().min(1),
  userId: z.string().min(1),
  status: z.nativeEnum(TrainingStatus),
  notes: z.string().trim().max(500).optional(),
});
