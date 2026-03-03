import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { EVENT_CONTRACTS } from "@/lib/events/contracts";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";
import { createWorkOrderSchema } from "@/lib/validators/work-orders";

const listSchema = z.object({
  workspaceId: z.string().min(1),
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  stationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

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
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid query.",
      status: 400,
    });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "fleet", "read");

    const workOrders = await db.workOrder.findMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.stationId ? { stationId: parsed.data.stationId } : {}),
      },
      include: {
        lines: true,
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true, slaHours: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: parsed.data.limit ?? 100,
    });

    return apiSuccess(
      {
        items: workOrders.map((order) => ({
          ...order,
          estimatedCost: order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
        })),
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "WORK_ORDER_LIST_FAILED",
      message: error instanceof Error ? error.message : "Failed to list work orders.",
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

  const parsed = createWorkOrderSchema.safeParse(payload);
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

    const created = await db.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          stationId: parsed.data.stationId ?? null,
          vehicleId: parsed.data.vehicleId ?? null,
          incidentId: parsed.data.incidentId ?? null,
          assignedToUserId: parsed.data.assignedToUserId ?? null,
          vendorId: parsed.data.vendorId ?? null,
          createdBy: user.id,
          status: parsed.data.assignedToUserId ? "ASSIGNED" : "OPEN",
          priority: parsed.data.priority ?? 3,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          ...(parsed.data.assignedToUserId ? { startedAt: new Date() } : {}),
        },
      });

      if (parsed.data.lines.length > 0) {
        await tx.workOrderLine.createMany({
          data: parsed.data.lines.map((line) => ({
            workOrderId: workOrder.id,
            lineType: line.lineType,
            description: line.description,
            quantity: line.quantity,
            unitCost: line.unitCost,
            notes: line.notes ?? null,
          })),
        });
      }

      return tx.workOrder.findUniqueOrThrow({
        where: { id: workOrder.id },
        include: { lines: true },
      });
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "work_order.created",
      entityType: "work_order",
      entityId: created.id,
      metaJson: {
        status: created.status,
        lineCount: created.lines.length,
      },
      source: "api",
    });

    return apiSuccess(
      {
        item: created,
        event: EVENT_CONTRACTS.find((event) => event === "workorder.updated"),
      },
      { requestId, status: 201 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "WORK_ORDER_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create work order.",
      status: 500,
    });
  }
}
