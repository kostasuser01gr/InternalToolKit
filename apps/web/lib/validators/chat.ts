import { z } from "zod";

export const createThreadSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(2).max(100),
});

export const sendMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
  modelId: z.string().trim().min(1).max(80).optional(),
});

export const regenerateMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  modelId: z.string().trim().min(1).max(80).optional(),
});

export const forkThreadSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  messageId: z.string().min(1).optional(),
});

export const pinMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  messageId: z.string().min(1),
  pinned: z.enum(["0", "1"]).optional(),
});

export const exportMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  messageId: z.string().min(1),
});

export const convertMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  messageId: z.string().min(1),
  target: z.enum(["automation", "report", "task"]),
});

export const createEntityThreadSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(2).max(100),
  entityType: z.enum(["vehicle", "washer_task", "shift", "shift_request"]),
  entityId: z.string().min(1),
});

export const mentionUserSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  mentionedUserId: z.string().min(1),
});

export const moderateMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  messageId: z.string().min(1),
  action: z.enum(["delete", "mute_author", "lock_thread"]),
});
