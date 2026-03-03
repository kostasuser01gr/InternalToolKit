import { z } from "zod";

export const purchaseOrderLineSchema = z.object({
  itemName: z.string().trim().min(2).max(200),
  sku: z.string().trim().max(120).optional(),
  quantity: z.coerce.number().min(0.01).max(100_000),
  unitCost: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(400).optional(),
});

export const createPurchaseOrderSchema = z.object({
  workspaceId: z.string().min(1),
  stationId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(200),
  needByAt: z.string().datetime().optional(),
  lines: z.array(purchaseOrderLineSchema).min(1).max(200),
});

export const updatePurchaseOrderSchema = z.object({
  workspaceId: z.string().min(1),
  purchaseOrderId: z.string().min(1),
  stationId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  needByAt: z.string().datetime().optional(),
});

export const purchaseOrderActionSchema = z.object({
  workspaceId: z.string().min(1),
  purchaseOrderId: z.string().min(1),
  action: z.enum(["approve", "reject", "receive"]),
  note: z.string().trim().max(400).optional(),
});
