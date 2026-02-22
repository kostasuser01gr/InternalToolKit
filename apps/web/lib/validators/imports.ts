import { z } from "zod";

export const createImportBatchSchema = z.object({
  workspaceId: z.string().min(1),
  importType: z.enum(["bookings", "fleet", "shifts", "mixed"]),
  fileName: z.string().trim().min(1).max(500),
  fileHash: z.string().min(1).max(128),
  fileSizeBytes: z.coerce.number().int().min(0).optional(),
  fileUrl: z.string().url().optional(),
});

export const updateMappingSchema = z.object({
  workspaceId: z.string().min(1),
  batchId: z.string().min(1),
  mappingJson: z.string().min(2),
});

export const acceptImportSchema = z.object({
  workspaceId: z.string().min(1),
  batchId: z.string().min(1),
});

export const declineImportSchema = z.object({
  workspaceId: z.string().min(1),
  batchId: z.string().min(1),
});

export const rollbackImportSchema = z.object({
  workspaceId: z.string().min(1),
  batchId: z.string().min(1),
});
