import { AssetType, AssetStatus } from "@prisma/client";
import { z } from "zod";

export const createAssetSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.nativeEnum(AssetType),
  name: z.string().trim().min(2).max(120),
  serialNumber: z.string().trim().max(100).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
});

export const updateAssetSchema = z.object({
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
  status: z.nativeEnum(AssetStatus).optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
});

export const recordHandoverSchema = z.object({
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
  toUserId: z.string().min(1).optional(),
  action: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(500).optional(),
});
