import { z } from "zod";

export const createStationSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  address: z.string().trim().max(300).optional(),
  configJson: z.string().optional(),
});

export const updateStationSchema = z.object({
  workspaceId: z.string().min(1),
  stationId: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().max(300).optional(),
  isActive: z.coerce.boolean().optional(),
  configJson: z.string().optional(),
});
