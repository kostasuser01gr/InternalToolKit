import { headers } from "next/headers";
import { ShieldCheck, Zap } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { ProgressPill } from "@/components/kit/progress-pill";
import { StatCard } from "@/components/kit/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { fetchApiHealth, getApiBaseUrl } from "@/lib/api-health";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const headerStore = await headers();
  const requestId = headerStore.get("x-request-id") ?? "n/a";
  const health = await fetchApiHealth();
  let dataStatus = false;
  try {
    const dataHealth = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    dataStatus = dataHealth.length > 0 && dataHealth[0]?.ok === 1;
  } catch {
    dataStatus = false;
  }
  const apiBaseUrl = getApiBaseUrl();

  return (
    <div className="page-stack" data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Operational snapshot for internal tools with backend API status and workflow activity."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Web Status"
          value="ok"
          delta={`request ${requestId}`}
          icon={ShieldCheck}
        />
        <StatCard
          label="API Status"
          value={health ? "ok" : "not ok"}
          delta={health ? "Worker reachable" : "Worker unavailable"}
          icon={ShieldCheck}
        />
        <StatCard
          label="Data Status"
          value={dataStatus ? "ok" : "not ok"}
          delta={dataStatus ? "Database reachable" : "Database unavailable"}
          icon={ShieldCheck}
        />
        <StatCard
          label="Live Automations"
          value="12"
          delta="Active in workspace"
          icon={Zap}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">API Status Widget</h2>
            <Badge variant={health ? "active" : "default"}>{health ? "ok" : "not ok"}</Badge>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">API URL</dt>
              <dd className="max-w-[65%] truncate text-right text-[var(--text)]">{apiBaseUrl}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Version</dt>
              <dd className="text-[var(--text)]">{health?.version ?? "n/a"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Timestamp</dt>
              <dd className="text-[var(--text)]">{health?.timestamp ?? "No response"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Web request id</dt>
              <dd className="text-[var(--text)]">{requestId}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Data layer</dt>
              <dd className="text-[var(--text)]">{dataStatus ? "ok" : "not ok"}</dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Workflow Capacity</h2>
          <ProgressPill label="Automation success" value={88} />
          <ProgressPill label="SLA compliance" value={93} />
          <ProgressPill label="Queue utilization" value={57} />
        </GlassCard>
      </section>
    </div>
  );
}
