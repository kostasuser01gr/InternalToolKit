import { PageHeader } from "@/components/layout/page-header";
import { GlassCard } from "@/components/kit/glass-card";
import { db } from "@/lib/db";
import { withDbFallback } from "@/lib/prisma-errors";
import { getAppContext } from "@/lib/app-context";

export default async function WorkOrdersPage() {
  const { workspace } = await getAppContext();

  const [summary, latest] = await Promise.all([
    withDbFallback(
      db.workOrder.groupBy({
        by: ["status"],
        where: { workspaceId: workspace.id },
        _count: { _all: true },
      }),
      [],
    ),
    withDbFallback(
      db.workOrder.findMany({
        where: { workspaceId: workspace.id },
        include: { assignee: { select: { name: true } }, vendor: { select: { name: true } } },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      [],
    ),
  ]);

  return (
    <div className="page-stack" data-testid="work-orders-page">
      <PageHeader
        title="Work Orders"
        subtitle="Maintenance lifecycle with assignment, blockers, and completion tracking."
      />

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {summary.map((item) => (
          <GlassCard key={item.status} className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.status}</p>
            <p className="kpi-font text-2xl font-semibold">{item._count._all}</p>
          </GlassCard>
        ))}
      </section>

      <section className="grid gap-3">
        {latest.map((order) => (
          <GlassCard key={order.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{order.title}</p>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs">{order.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Priority {order.priority} · Assignee {order.assignee?.name ?? "Unassigned"} · Vendor {order.vendor?.name ?? "-"}
            </p>
          </GlassCard>
        ))}
      </section>
    </div>
  );
}
