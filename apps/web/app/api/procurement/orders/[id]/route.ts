import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";
import { updatePurchaseOrderSchema } from "@/lib/validators/procurement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const querySchema = z.object({
  workspaceId: z.string().min(1),
});

const deleteSchema = z.object({
  workspaceId: z.string().min(1),
});

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({ workspaceId: searchParams.get("workspaceId") ?? "" });
  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "workspaceId is required.", status: 400 });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "data", "read");

    const item = await db.purchaseOrder.findFirst({
      where: {
        id,
        workspaceId: parsed.data.workspaceId,
      },
      include: {
        lines: true,
        vendor: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Purchase order not found.", status: 404 });
    }

    return apiSuccess({ item }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "PROCUREMENT_READ_FAILED",
      message: error instanceof Error ? error.message : "Failed to read purchase order.",
      status: 500,
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = updatePurchaseOrderSchema.safeParse({
    purchaseOrderId: id,
    ...(payload as Record<string, unknown>),
  });

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

    const existing = await db.purchaseOrder.findFirst({
      where: {
        id: parsed.data.purchaseOrderId,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!existing) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Purchase order not found.", status: 404 });
    }

    if (["RECEIVED", "CANCELLED"].includes(existing.status)) {
      return apiError({
        requestId,
        code: "LOCKED_STATUS",
        message: `Order in status ${existing.status} is immutable.`,
        status: 409,
      });
    }

    const item = await db.purchaseOrder.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.stationId !== undefined ? { stationId: parsed.data.stationId } : {}),
        ...(parsed.data.vendorId !== undefined ? { vendorId: parsed.data.vendorId } : {}),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.needByAt !== undefined ? { needByAt: new Date(parsed.data.needByAt) } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "procurement.order_updated",
      entityType: "purchase_order",
      entityId: item.id,
      source: "api",
    });

    return apiSuccess({ item }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "PROCUREMENT_UPDATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to update purchase order.",
      status: 500,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = deleteSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "workspaceId is required.", status: 400 });
  }

  try {
    const { user } = await requireWorkspacePermission(parsed.data.workspaceId, "data", "write");

    const existing = await db.purchaseOrder.findFirst({
      where: {
        id,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!existing) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Purchase order not found.", status: 404 });
    }

    const item = await db.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "procurement.order_cancelled",
      entityType: "purchase_order",
      entityId: item.id,
      source: "api",
    });

    return apiSuccess({ item }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "PROCUREMENT_DELETE_FAILED",
      message: error instanceof Error ? error.message : "Failed to cancel purchase order.",
      status: 500,
    });
  }
}
