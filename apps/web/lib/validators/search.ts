import { z } from "zod";

export const createSavedViewSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  module: z.string().trim().min(1).max(50),
  filtersJson: z.string().min(2),
  columnsJson: z.string().optional(),
  sortJson: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
});

export const createRunbookSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(50000),
  tags: z.string().trim().max(500).optional(),
  pinned: z.coerce.boolean().optional(),
});

export const updateRunbookSchema = z.object({
  workspaceId: z.string().min(1),
  runbookId: z.string().min(1),
  title: z.string().trim().min(3).max(200).optional(),
  content: z.string().trim().min(10).max(50000).optional(),
  tags: z.string().trim().max(500).optional(),
  pinned: z.coerce.boolean().optional(),
});
