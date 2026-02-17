import { z } from "zod";

export const APP_NAME = "InternalToolKit";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const demoUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

export type DemoUser = z.infer<typeof demoUserSchema>;

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

const assistantDraftRequestInputSchema = z
  .object({
    text: z.string().trim().min(3).max(3000).optional(),
    prompt: z.string().trim().min(3).max(3000).optional(),
  })
  .refine((value) => Boolean(value.text || value.prompt), {
    message: "Provide either text or prompt.",
  });

export const assistantDraftRequestSchema = assistantDraftRequestInputSchema.transform(
  (value) => ({
    prompt: value.prompt ?? value.text ?? "",
  }),
);

export type AssistantDraftRequest = z.infer<typeof assistantDraftRequestSchema>;

const assistantActionSchema = z.object({
  type: z.enum(["create_notification", "write_audit_log", "update_record"]),
  config: z.record(z.string(), z.unknown()),
});

export const automationDraftSchema = z.object({
  name: z.string().min(3).max(120),
  trigger: z.object({
    type: z.enum(["record.created", "record.updated", "schedule.cron"]),
    config: z.record(z.string(), z.unknown()),
  }),
  actions: z.array(assistantActionSchema).min(1),
  rationale: z.string().min(1),
});

export type AutomationDraft = z.infer<typeof automationDraftSchema>;

export const assistantDraftResponseSchema = z.object({
  ok: z.literal(true),
  draft: automationDraftSchema,
});

export type AssistantDraftResponse = z.infer<typeof assistantDraftResponseSchema>;
