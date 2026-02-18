import { z } from "zod";

export const APP_NAME = "InternalToolKit";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const auditEventInputSchema = z.object({
  action: z.string().trim().min(1).max(120),
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEventInput = z.infer<typeof auditEventInputSchema>;

export const auditEventSchema = auditEventInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditCreatedResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().min(1),
});

export type AuditCreatedResponse = z.infer<typeof auditCreatedResponseSchema>;

export const assistantDraftRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(3000),
});

export type AssistantDraftRequest = z.infer<typeof assistantDraftRequestSchema>;

export const assistantDraftResponseSchema = z.object({
  ok: z.literal(true),
  triggerJson: z.record(z.string(), z.unknown()),
  actionsJson: z.array(z.record(z.string(), z.unknown())).min(1),
});

export type AssistantDraftResponse = z.infer<typeof assistantDraftResponseSchema>;
