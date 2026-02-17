import { FileText, Layers } from "lucide-react";

import { ExportButton } from "@/components/kit/export-button";
import { FilterBar } from "@/components/kit/filter-bar";
import { GlassCard } from "@/components/kit/glass-card";
import { PdfPlaceholderButton } from "@/components/kit/pdf-placeholder-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { features } from "@/lib/constants/features";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/app-context";

type ReportsPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    q?: string;
    from?: string;
    to?: string;
    period?: "week" | "month" | "year";
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext(params.workspaceId);

  const tables = await db.table.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: {
        select: { records: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const filtered = params.q
    ? tables.filter((table) => table.name.toLowerCase().includes(params.q!.toLowerCase()))
    : tables;

  return (
    <div className="page-stack" data-testid="reports-page">
      <PageHeader
        title="Reports"
        subtitle="Centralized export center for operational reporting, audits, and executive snapshots."
      />

      <FilterBar
        defaultQuery={params.q}
        defaultFrom={params.from}
        defaultTo={params.to}
        defaultPeriod={params.period ?? "month"}
        hiddenFields={[{ name: "workspaceId", value: workspace.id }]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">CSV Exports</h2>
            <Badge variant="active">{filtered.length}</Badge>
          </div>
          <ul className="space-y-2">
            {filtered.map((table) => (
              <li
                key={table.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-[var(--text)]">{table.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {table._count.records} records
                  </p>
                </div>
                <ExportButton
                  href={`/data/export?workspaceId=${workspace.id}&tableId=${table.id}`}
                  label="Export CSV"
                />
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-5 text-sm text-[var(--text-muted)]">
                No tables match the current report filters.
              </li>
            ) : null}
          </ul>
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">Document Exports</h2>
            <Badge variant="default">Placeholder</Badge>
          </div>
          <div className="space-y-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="size-4 text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text)]">Executive Summary</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Generate compact weekly snapshots from KPIs and incident metrics.
              </p>
            </div>

            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Layers className="size-4 text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text)]">Audit Package</p>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Bundle action logs and role changes for periodic compliance review.
              </p>
            </div>

            {features.reportsPdf ? (
              <PdfPlaceholderButton />
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                PDF export is disabled. Enable `NEXT_PUBLIC_FEATURE_REPORTS_PDF=1` to show it.
              </p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
