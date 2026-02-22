import { ChatChannelType } from "@prisma/client";
import { z } from "zod";

export const createChannelSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.nativeEnum(ChatChannelType).optional(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(50).toLowerCase().regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional(),
  isReadOnly: z.coerce.boolean().optional(),
});

export const updateChannelSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  isPinned: z.coerce.boolean().optional(),
  isArchived: z.coerce.boolean().optional(),
  isReadOnly: z.coerce.boolean().optional(),
});

export const joinChannelSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
});

export const sendChannelMessageSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  content: z.string().trim().min(1).max(10000),
  replyToId: z.string().min(1).optional(),
  attachmentUrl: z.string().url().optional(),
  attachmentMime: z.string().max(100).optional(),
  mentionsJson: z.string().optional(),
});

export const reactToMessageSchema = z.object({
  workspaceId: z.string().min(1),
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(10),
});

export const pinMessageSchema = z.object({
  workspaceId: z.string().min(1),
  messageId: z.string().min(1),
  isPinned: z.coerce.boolean(),
});
