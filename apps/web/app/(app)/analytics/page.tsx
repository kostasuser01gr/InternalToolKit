import { AlertCircle, Bot, ChartNoAxesCombined, Database } from "lucide-react";

import { LazyAnalyticsCharts } from "@/components/kit/charts/lazy-analytics-charts";
import { GlassCard } from "@/components/kit/glass-card";
import { StatCard } from "@/components/kit/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

export default async function AnalyticsPage() {
  const { workspace } = await getAppContext();

  function safeCount(p: Promise<number>) {
    return p.catch((err: unknown) => {
      if (!isSchemaNotReadyError(err)) throw err;
      return 0;
    });
  }

  const [tableCount, records, automationCount] = await Promise.all([
    safeCount(db.table.count({ where: { workspaceId: workspace.id } })),
    safeCount(db.record.count({
      where: {
        table: { workspaceId: workspace.id },
      },
    })),
    safeCount(db.automation.count({ where: { workspaceId: workspace.id } })),
  ]);

  const recordCount = records;
  const openIncidentCount = await safeCount(db.record.count({
    where: {
      table: { workspaceId: workspace.id },
      openIndicator: true,
    },
  }));

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <PageHeader
        title="Analytics"
        subtitle="KPI-first layout with stable chart containers and responsive card stacks across devices."
      />

      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="KPI cards"
      >
        <StatCard
          label="Total Tables"
          value={String(tableCount)}
          delta="+2 this month"
          trendPercent={6.2}
          icon={Database}
        />
        <StatCard
          label="Total Records"
          value={String(recordCount)}
          delta="+14% weekly"
          trendPercent={14}
          icon={ChartNoAxesCombined}
        />
        <StatCard
          label="Automations"
          value={String(automationCount)}
          delta="3 active today"
          trendPercent={4.8}
          icon={Bot}
        />
        <StatCard
          label="Open Incidents"
          value={String(openIncidentCount)}
          delta="-8% weekly"
          trendPercent={-8}
          icon={AlertCircle}
        />
      </section>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Dashboard charts</h2>
        <LazyAnalyticsCharts />
      </GlassCard>
    </div>
  );
}
