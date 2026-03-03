import { PageHeader } from "@/components/layout/page-header";
import { GlassCard } from "@/components/kit/glass-card";
import { db } from "@/lib/db";
import { withDbFallback } from "@/lib/prisma-errors";
import { getAppContext } from "@/lib/app-context";

export default async function ProcurementPage() {
  const { workspace } = await getAppContext();

  const [summary, latest] = await Promise.all([
    withDbFallback(
      db.purchaseOrder.groupBy({
        by: ["status"],
        where: { workspaceId: workspace.id },
        _count: { _all: true },
      }),
      [],
    ),
    withDbFallback(
      db.purchaseOrder.findMany({
        where: { workspaceId: workspace.id },
        include: {
          requester: { select: { name: true } },
          approver: { select: { name: true } },
          vendor: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
      }),
      [],
    ),
  ]);

  return (
    <div className="page-stack" data-testid="procurement-page">
      <PageHeader
        title="Procurement"
        subtitle="Purchase request approvals, vendor SLA tracking, and receiving workflow."
      />

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
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
              Vendor {order.vendor?.name ?? "-"} · Requested by {order.requester.name} · Approved by {order.approver?.name ?? "-"}
            </p>
            <p className="kpi-font text-lg font-semibold">€{order.grandTotal.toFixed(2)}</p>
          </GlassCard>
        ))}
      </section>
    </div>
  );
}
