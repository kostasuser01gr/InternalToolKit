import { PageHeader } from "@/components/layout/page-header";
import { GlassCard } from "@/components/kit/glass-card";
import { db } from "@/lib/db";
import { withDbFallback } from "@/lib/prisma-errors";
import { getAppContext } from "@/lib/app-context";

export default async function CostsPage() {
  const { workspace } = await getAppContext();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [laborLines, partLines, procurementSpend, completedTasks] = await Promise.all([
    withDbFallback(
      db.workOrderLine.findMany({
        where: {
          lineType: "LABOR",
          workOrder: {
            workspaceId: workspace.id,
            createdAt: { gte: since },
          },
        },
        select: { quantity: true, unitCost: true },
      }),
      [],
    ),
    withDbFallback(
      db.workOrderLine.findMany({
        where: {
          lineType: "PART",
          workOrder: {
            workspaceId: workspace.id,
            createdAt: { gte: since },
          },
        },
        select: { quantity: true, unitCost: true },
      }),
      [],
    ),
    withDbFallback(
      db.purchaseOrder.aggregate({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: since },
          status: { in: ["APPROVED", "ORDERED", "RECEIVED"] },
        },
        _sum: {
          grandTotal: true,
        },
      }),
      { _sum: { grandTotal: 0 } },
    ),
    withDbFallback(
      db.washerTask.count({
        where: {
          workspaceId: workspace.id,
          status: "DONE",
          updatedAt: { gte: since },
        },
      }),
      0,
    ),
  ]);

  const laborCost = laborLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const partsCost = partLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const purchasingCost = procurementSpend._sum.grandTotal ?? 0;
  const totalCost = laborCost + partsCost + purchasingCost;
  const estimatedRevenue = completedTasks * 55;
  const margin = estimatedRevenue - totalCost;

  return (
    <div className="page-stack" data-testid="costs-page">
      <PageHeader
        title="Costs & Profitability"
        subtitle="Per-week cost rollups from labor, parts, and procurement with estimated gross margin."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <GlassCard className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Labor Cost (7d)</p>
          <p className="kpi-font text-2xl font-semibold">€{laborCost.toFixed(2)}</p>
        </GlassCard>
        <GlassCard className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Parts Cost (7d)</p>
          <p className="kpi-font text-2xl font-semibold">€{partsCost.toFixed(2)}</p>
        </GlassCard>
        <GlassCard className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Procurement (7d)</p>
          <p className="kpi-font text-2xl font-semibold">€{purchasingCost.toFixed(2)}</p>
        </GlassCard>
        <GlassCard className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Cost (7d)</p>
          <p className="kpi-font text-2xl font-semibold">€{totalCost.toFixed(2)}</p>
        </GlassCard>
        <GlassCard className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Margin (7d)</p>
          <p className="kpi-font text-2xl font-semibold">€{margin.toFixed(2)}</p>
        </GlassCard>
      </section>
    </div>
  );
}
