import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { EVENT_CONTRACTS } from "@/lib/events/contracts";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";
import { purchaseOrderActionSchema } from "@/lib/validators/procurement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = purchaseOrderActionSchema.safeParse({
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
    const { user } = await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN", "EDITOR"]);

    const order = await db.purchaseOrder.findFirst({
      where: {
        id: parsed.data.purchaseOrderId,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!order) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Purchase order not found.", status: 404 });
    }

    let nextStatus = order.status;
    let event: string | null = null;

    if (parsed.data.action === "approve") {
      const dualApprovalThreshold = 5000;
      if (order.grandTotal >= dualApprovalThreshold && order.requestedBy === user.id) {
        return apiError({
          requestId,
          code: "DUAL_APPROVAL_REQUIRED",
          message: "Order requires approval by a different admin due to amount threshold.",
          status: 409,
        });
      }
      nextStatus = "APPROVED";
    }

    if (parsed.data.action === "reject") {
      nextStatus = "REJECTED";
    }

    if (parsed.data.action === "receive") {
      if (!["APPROVED", "ORDERED"].includes(order.status)) {
        return apiError({
          requestId,
          code: "INVALID_STATUS",
          message: `Order in status ${order.status} cannot be received.`,
          status: 409,
        });
      }
      nextStatus = "RECEIVED";
      event = EVENT_CONTRACTS.find((item) => item === "procurement.received") ?? null;
    }

    const updated = await db.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        ...(parsed.data.action === "approve" ? { approvedBy: user.id, approvedAt: new Date() } : {}),
        ...(parsed.data.action === "receive" ? { receivedAt: new Date() } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: `procurement.order_${parsed.data.action}`,
      entityType: "purchase_order",
      entityId: updated.id,
      metaJson: {
        fromStatus: order.status,
        toStatus: updated.status,
        note: parsed.data.note ?? null,
      },
      source: "api",
    });

    return apiSuccess({ item: updated, event }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "PROCUREMENT_ACTION_FAILED",
      message: error instanceof Error ? error.message : "Failed to run procurement action.",
      status: 500,
    });
  }
}
