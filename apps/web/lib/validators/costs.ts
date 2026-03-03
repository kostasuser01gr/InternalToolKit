import { z } from "zod";

export const costsSummaryQuerySchema = z.object({
  workspaceId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const stationCostsQuerySchema = z.object({
  workspaceId: z.string().min(1),
  stationId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
