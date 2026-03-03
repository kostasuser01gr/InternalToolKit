import { costsSummaryQuerySchema } from "@/lib/validators/costs";
import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseRange(input: { from?: string | undefined; to?: string | undefined }) {
  const from = input.from ? new Date(input.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = input.to ? new Date(input.to) : new Date();
  return { from, to };
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);

  const parsed = costsSummaryQuerySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "Invalid query.", status: 400 });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "analytics", "read");

    const { from, to } = parseRange(parsed.data);

    const [station, workOrders, purchaseOrders, completedTasks] = await Promise.all([
      db.station.findFirst({
        where: {
          id,
          workspaceId: parsed.data.workspaceId,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      }),
      db.workOrder.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          stationId: id,
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          lines: {
            select: {
              lineType: true,
              quantity: true,
              unitCost: true,
            },
          },
        },
      }),
      db.purchaseOrder.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          stationId: id,
          createdAt: { gte: from, lte: to },
          status: { in: ["APPROVED", "ORDERED", "RECEIVED"] },
        },
        select: {
          createdAt: true,
          grandTotal: true,
          status: true,
        },
      }),
      db.washerTask.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          stationId: id,
          status: "DONE",
          updatedAt: { gte: from, lte: to },
        },
        select: {
          updatedAt: true,
        },
      }),
    ]);

    if (!station) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Station not found.", status: 404 });
    }

    const daily = new Map<string, { laborCost: number; partsCost: number; procurementCost: number; completedTasks: number }>();

    for (const order of workOrders) {
      const day = toDayKey(order.createdAt);
      const entry = daily.get(day) ?? { laborCost: 0, partsCost: 0, procurementCost: 0, completedTasks: 0 };
      for (const line of order.lines) {
        const amount = line.quantity * line.unitCost;
        if (line.lineType === "LABOR") {
          entry.laborCost += amount;
        } else {
          entry.partsCost += amount;
        }
      }
      daily.set(day, entry);
    }

    for (const order of purchaseOrders) {
      const day = toDayKey(order.createdAt);
      const entry = daily.get(day) ?? { laborCost: 0, partsCost: 0, procurementCost: 0, completedTasks: 0 };
      entry.procurementCost += order.grandTotal;
      daily.set(day, entry);
    }

    for (const task of completedTasks) {
      const day = toDayKey(task.updatedAt);
      const entry = daily.get(day) ?? { laborCost: 0, partsCost: 0, procurementCost: 0, completedTasks: 0 };
      entry.completedTasks += 1;
      daily.set(day, entry);
    }

    const timeline = [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, values]) => {
        const totalCost = values.laborCost + values.partsCost + values.procurementCost;
        const estimatedRevenue = values.completedTasks * 55;
        const margin = estimatedRevenue - totalCost;
        return {
          day,
          laborCost: Number(values.laborCost.toFixed(2)),
          partsCost: Number(values.partsCost.toFixed(2)),
          procurementCost: Number(values.procurementCost.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2)),
          completedTasks: values.completedTasks,
          estimatedRevenue: Number(estimatedRevenue.toFixed(2)),
          margin: Number(margin.toFixed(2)),
        };
      });

    return apiSuccess(
      {
        station,
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        timeline,
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "STATION_COST_FAILED",
      message: error instanceof Error ? error.message : "Failed to compute station costs.",
      status: 500,
    });
  }
}
