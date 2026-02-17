import { z } from "zod";

export const triggerTypeSchema = z.enum([
  "record.created",
  "record.updated",
  "schedule.cron.daily",
]);

export const createAutomationSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  enabled: z.boolean().default(true),
  triggerType: triggerTypeSchema,
  triggerTableId: z.string().optional(),
  notificationUserId: z.string().optional(),
  notificationTitle: z.string().max(120).optional(),
  notificationBody: z.string().max(240).optional(),
  auditAction: z.string().max(120).optional(),
  updateRecordTableId: z.string().optional(),
  updateRecordId: z.string().optional(),
  updateRecordField: z.string().max(120).optional(),
  updateRecordValue: z.string().max(500).optional(),
});

export const runAutomationSchema = z.object({
  workspaceId: z.string().min(1),
  automationId: z.string().min(1),
});
