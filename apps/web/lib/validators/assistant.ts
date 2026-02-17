import { z } from "zod";

export const summarizeTableSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
  filterText: z.string().max(120).optional(),
});

export const automationDraftSchema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().trim().min(10).max(1500),
});

export const kpiDraftSchema = z.object({
  workspaceId: z.string().min(1),
  objective: z.string().trim().min(10).max(1000),
});
