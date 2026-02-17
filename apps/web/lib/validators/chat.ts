import { z } from "zod";

export const createThreadSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(2).max(100),
});

export const sendMessageSchema = z.object({
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
});
