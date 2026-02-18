import { z } from "zod";

export const calendarRangeSchema = z.object({
  workspaceId: z.string().min(1),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
