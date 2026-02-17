import { Activity, ShieldCheck, Zap } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { ProgressPill } from "@/components/kit/progress-pill";
import { StatCard } from "@/components/kit/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { fetchApiHealth, getApiBaseUrl } from "@/lib/api-health";

export default async function DashboardPage() {
  const health = await fetchApiHealth();
  const apiBaseUrl = getApiBaseUrl();

  return (
    <div className="page-stack" data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Operational snapshot for internal tools with backend API status and workflow activity."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="API Connectivity"
          value={health ? "Online" : "Offline"}
          delta={health ? "Worker reachable" : "Worker unavailable"}
          icon={ShieldCheck}
        />
        <StatCard
          label="Live Automations"
          value="12"
          delta="Active in workspace"
          icon={Zap}
        />
        <StatCard
          label="Audit Throughput"
          value="184"
          delta="Events in 24h"
          icon={Activity}
        />
        <StatCard
          label="Latency"
          value={health ? "42ms" : "--"}
          delta="P95 simulated"
          icon={Zap}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">Backend Health</h2>
            <Badge variant={health ? "active" : "default"}>{health ? "Healthy" : "Degraded"}</Badge>
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
