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

export const aiProviderIdSchema = z.enum([
  "free-cloud-primary",
  "free-cloud-secondary",
  "mock-fallback",
]);

export type AiProviderId = z.infer<typeof aiProviderIdSchema>;

export const aiChatTaskSchema = z.enum([
  "summarize_table",
  "automation_draft",
  "kpi_layout",
  "chat",
]);

export type AiChatTask = z.infer<typeof aiChatTaskSchema>;

export const aiChatRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  task: aiChatTaskSchema.optional(),
  modelId: z.string().trim().min(1).max(80).optional(),
  stream: z.boolean().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiUsageSchema = z.object({
  requestsUsed: z.number().int().nonnegative(),
  requestsLimit: z.number().int().positive(),
  tokensUsed: z.number().int().nonnegative(),
  tokensLimit: z.number().int().positive(),
});

export type AiUsage = z.infer<typeof aiUsageSchema>;

export const aiChatResponseSchema = z.object({
  ok: z.literal(true),
  provider: aiProviderIdSchema,
  modelId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
  latencyMs: z.number().int().nonnegative(),
  content: z.string(),
  usage: aiUsageSchema.optional(),
});

export type AiChatResponse = z.infer<typeof aiChatResponseSchema>;

export const aiChatChunkSchema = z.object({
  provider: aiProviderIdSchema,
  requestId: z.string().trim().min(1),
  delta: z.string(),
  done: z.boolean(),
  modelId: z.string().trim().min(1),
});

export type AiChatChunk = z.infer<typeof aiChatChunkSchema>;

export const aiUsageResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.literal("free-only"),
  providers: z.array(aiProviderIdSchema),
  usage: aiUsageSchema,
});

export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;

export const shortcutDefinitionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  command: z.string().trim().min(1).max(300),
  keybinding: z.string().trim().max(40).optional(),
  position: z.number().int().min(0).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ShortcutDefinition = z.infer<typeof shortcutDefinitionSchema>;

export const actionButtonDefinitionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().trim().min(1).max(40),
  action: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(200),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ActionButtonDefinition = z.infer<typeof actionButtonDefinitionSchema>;

export const chatArtifactPayloadSchema = z.object({
  type: z.enum(["markdown", "json", "task", "automation", "report"]),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(20_000),
});

export type ChatArtifactPayload = z.infer<typeof chatArtifactPayloadSchema>;
