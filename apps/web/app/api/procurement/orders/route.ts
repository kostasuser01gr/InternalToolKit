import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";
import { createPurchaseOrderSchema } from "@/lib/validators/procurement";

const listSchema = z.object({
  workspaceId: z.string().min(1),
  status: z
    .enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ORDERED", "RECEIVED", "CANCELLED"])
    .optional(),
  stationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

function calculateTotals(lines: Array<{ quantity: number; unitCost: number }>) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const taxTotal = subtotal * 0.24;
  const grandTotal = subtotal + taxTotal;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxTotal: Number(taxTotal.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
  };
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = listSchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    status: searchParams.get("status") ?? undefined,
    stationId: searchParams.get("stationId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "Invalid query.", status: 400 });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "data", "read");

    const items = await db.purchaseOrder.findMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.stationId ? { stationId: parsed.data.stationId } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true, slaHours: true } },
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        lines: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: parsed.data.limit ?? 100,
    });

    return apiSuccess({ items }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "PROCUREMENT_LIST_FAILED",
      message: error instanceof Error ? error.message : "Failed to list purchase orders.",
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = createPurchaseOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    const { user } = await requireWorkspacePermission(parsed.data.workspaceId, "data", "write");
    const totals = calculateTotals(parsed.data.lines);

    const purchaseOrder = await db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          stationId: parsed.data.stationId ?? null,
          vendorId: parsed.data.vendorId ?? null,
          requestedBy: user.id,
          status: "PENDING_APPROVAL",
          title: parsed.data.title,
          needByAt: parsed.data.needByAt ? new Date(parsed.data.needByAt) : null,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
        },
      });

      await tx.purchaseOrderLine.createMany({
        data: parsed.data.lines.map((line) => ({
          purchaseOrderId: po.id,
          itemName: line.itemName,
          sku: line.sku ?? null,
          quantity: line.quantity,
          unitCost: line.unitCost,
          notes: line.notes ?? null,
        })),
      });

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: po.id },
        include: { lines: true },
      });
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "procurement.order_created",
      entityType: "purchase_order",
      entityId: purchaseOrder.id,
      metaJson: {
        total: purchaseOrder.grandTotal,
        lines: purchaseOrder.lines.length,
      },
      source: "api",
    });

    return apiSuccess({ item: purchaseOrder }, { requestId, status: 201 });
  } catch (error) {
    return apiError({
      requestId,
      code: "PROCUREMENT_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create purchase order.",
      status: 500,
    });
  }
}
