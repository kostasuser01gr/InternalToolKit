import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";
import { costsSummaryQuerySchema } from "@/lib/validators/costs";

function parseRange(input: { from?: string | undefined; to?: string | undefined }) {
  const from = input.from ? new Date(input.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = input.to ? new Date(input.to) : new Date();
  return { from, to };
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
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

    const [laborLines, partLines, purchaseOrders, completedTasks, activeCostCenters] = await Promise.all([
      db.workOrderLine.findMany({
        where: {
          lineType: "LABOR",
          workOrder: {
            workspaceId: parsed.data.workspaceId,
            createdAt: { gte: from, lte: to },
          },
        },
        select: { quantity: true, unitCost: true },
      }),
      db.workOrderLine.findMany({
        where: {
          lineType: "PART",
          workOrder: {
            workspaceId: parsed.data.workspaceId,
            createdAt: { gte: from, lte: to },
          },
        },
        select: { quantity: true, unitCost: true },
      }),
      db.purchaseOrder.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          createdAt: { gte: from, lte: to },
          status: { in: ["APPROVED", "ORDERED", "RECEIVED"] },
        },
        select: { grandTotal: true },
      }),
      db.washerTask.count({
        where: {
          workspaceId: parsed.data.workspaceId,
          status: "DONE",
          updatedAt: { gte: from, lte: to },
        },
      }),
      db.costCenter.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          overheadPerHour: true,
        },
      }),
    ]);

    const laborCost = laborLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const partsCost = partLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const procurementSpend = purchaseOrders.reduce((sum, order) => sum + order.grandTotal, 0);
    const overheadCost = activeCostCenters.reduce((sum, center) => sum + center.overheadPerHour * 8, 0);
    const totalCost = laborCost + partsCost + procurementSpend + overheadCost;

    const nominalRevenuePerTask = 55;
    const estimatedRevenue = completedTasks * nominalRevenuePerTask;
    const grossMargin = estimatedRevenue - totalCost;
    const marginPct = estimatedRevenue > 0 ? (grossMargin / estimatedRevenue) * 100 : 0;

    return apiSuccess(
      {
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        totals: {
          laborCost: Number(laborCost.toFixed(2)),
          partsCost: Number(partsCost.toFixed(2)),
          procurementSpend: Number(procurementSpend.toFixed(2)),
          overheadCost: Number(overheadCost.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2)),
          estimatedRevenue: Number(estimatedRevenue.toFixed(2)),
          grossMargin: Number(grossMargin.toFixed(2)),
          marginPct: Number(marginPct.toFixed(2)),
        },
        operations: {
          completedTasks,
          laborHours: Number(laborLines.reduce((sum, line) => sum + line.quantity, 0).toFixed(2)),
        },
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "COST_SUMMARY_FAILED",
      message: error instanceof Error ? error.message : "Failed to compute costs summary.",
      status: 500,
    });
  }
}
