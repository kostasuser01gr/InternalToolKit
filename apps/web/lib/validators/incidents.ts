import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { z } from "zod";

export const createIncidentSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  severity: z.nativeEnum(IncidentSeverity),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  photosJson: z.string().optional(),
});

export const updateIncidentSchema = z.object({
  workspaceId: z.string().min(1),
  incidentId: z.string().min(1),
  status: z.nativeEnum(IncidentStatus).optional(),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  repairEta: z.string().datetime().optional(),
  repairCost: z.coerce.number().min(0).optional(),
  claimRef: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});
