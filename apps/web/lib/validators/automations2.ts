import { AutomationRuleStatus } from "@prisma/client";
import { z } from "zod";

export const createAutomationRuleSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  triggerJson: z.string().min(2),
  conditionJson: z.string().optional(),
  actionJson: z.string().min(2),
  schedule: z.string().trim().max(100).optional(),
  retryMax: z.coerce.number().int().min(0).max(10).optional(),
});

export const updateAutomationRuleSchema = z.object({
  workspaceId: z.string().min(1),
  ruleId: z.string().min(1),
  name: z.string().trim().min(3).max(120).optional(),
  status: z.nativeEnum(AutomationRuleStatus).optional(),
  triggerJson: z.string().min(2).optional(),
  conditionJson: z.string().optional(),
  actionJson: z.string().min(2).optional(),
  schedule: z.string().trim().max(100).optional(),
});
