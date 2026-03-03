import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { EVENT_CONTRACTS } from "@/lib/events/contracts";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";
import { updateWorkOrderSchema } from "@/lib/validators/work-orders";
import { canTransitionWorkOrder } from "@/lib/work-orders-state";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const getQuerySchema = z.object({
  workspaceId: z.string().min(1),
});

const updateSchema = updateWorkOrderSchema.extend({
  nextStatus: z
    .enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"])
    .optional(),
});

const deleteSchema = z.object({
  workspaceId: z.string().min(1),
});

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);

  const parsed = getQuerySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "workspaceId is required.", status: 400 });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "fleet", "read");

    const item = await db.workOrder.findFirst({
      where: {
        id,
        workspaceId: parsed.data.workspaceId,
      },
      include: {
        lines: true,
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Work order not found.", status: 404 });
    }

    return apiSuccess({ item }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "WORK_ORDER_READ_FAILED",
      message: error instanceof Error ? error.message : "Failed to read work order.",
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

  const parsed = updateSchema.safeParse({
    workOrderId: id,
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
    const { user } = await requireWorkspacePermission(parsed.data.workspaceId, "fleet", "write");

    const existing = await db.workOrder.findFirst({
      where: {
        id: parsed.data.workOrderId,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!existing) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Work order not found.", status: 404 });
    }

    const nextStatus = parsed.data.nextStatus ?? existing.status;
    if (!canTransitionWorkOrder(existing.status, nextStatus)) {
      return apiError({
        requestId,
        code: "INVALID_TRANSITION",
        message: `Cannot transition from ${existing.status} to ${nextStatus}.`,
        status: 409,
      });
    }

    const updated = await db.workOrder.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.stationId !== undefined ? { stationId: parsed.data.stationId } : {}),
        ...(parsed.data.vehicleId !== undefined ? { vehicleId: parsed.data.vehicleId } : {}),
        ...(parsed.data.incidentId !== undefined ? { incidentId: parsed.data.incidentId } : {}),
        ...(parsed.data.assignedToUserId !== undefined ? { assignedToUserId: parsed.data.assignedToUserId } : {}),
        ...(parsed.data.vendorId !== undefined ? { vendorId: parsed.data.vendorId } : {}),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        status: nextStatus,
        ...(nextStatus === "IN_PROGRESS" && !existing.startedAt ? { startedAt: new Date() } : {}),
        ...(nextStatus === "DONE" ? { completedAt: new Date() } : {}),
      },
      include: { lines: true },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "work_order.updated",
      entityType: "work_order",
      entityId: updated.id,
      metaJson: {
        fromStatus: existing.status,
        toStatus: updated.status,
      },
      source: "api",
    });

    return apiSuccess(
      {
        item: updated,
        event: EVENT_CONTRACTS.find((event) => event === "workorder.updated"),
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "WORK_ORDER_UPDATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to update work order.",
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
    const { user } = await requireWorkspacePermission(parsed.data.workspaceId, "fleet", "write");

    const existing = await db.workOrder.findFirst({
      where: {
        id,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!existing) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Work order not found.", status: 404 });
    }

    const cancelled = await db.workOrder.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
      },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "work_order.cancelled",
      entityType: "work_order",
      entityId: cancelled.id,
      source: "api",
    });

    return apiSuccess({ item: cancelled }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "WORK_ORDER_DELETE_FAILED",
      message: error instanceof Error ? error.message : "Failed to cancel work order.",
      status: 500,
    });
  }
}
