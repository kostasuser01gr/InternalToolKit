import { BarChart3, Database, MessageSquare, Workflow } from "lucide-react";
import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { StatCard } from "@/components/kit/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { WeatherWidgetGeo } from "@/components/widgets/weather-widget-geo";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/app-context";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

type HomePageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext();

  function safeCount(p: Promise<number>) {
    return p.catch((err: unknown) => {
      if (!isDatabaseUnavailableError(err)) throw err;
      return 0;
    });
  }
  function safeFindMany<T>(p: Promise<T[]>) {
    return p.catch((err: unknown): T[] => {
      if (!isDatabaseUnavailableError(err)) throw err;
      return [];
    });
  }

  const [
    tableCount,
    recordCount,
    automationCount,
    threadCount,
    recentNotifications,
    recentAudit,
  ] = await Promise.all([
    safeCount(db.table.count({ where: { workspaceId: workspace.id } })),
    safeCount(db.record.count({ where: { table: { workspaceId: workspace.id } } })),
    safeCount(db.automation.count({ where: { workspaceId: workspace.id } })),
    safeCount(db.chatThread.count({ where: { workspaceId: workspace.id } })),
    safeFindMany(db.notification.findMany({
      where: {
        user: {
          workspaceMemberships: {
            some: {
              workspaceId: workspace.id,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    })),
    safeFindMany(db.auditLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 4,
    })),
  ]);

  return (
    <div className="space-y-6" data-testid="home-page">
      <PageHeader
        title="Overview"
        subtitle="Today snapshot of operational health, data throughput, automations, and governance events."
      />

      <StatusBanner error={params.error} success={params.success} />

      {/* Weather with browser geolocation */}
      <WeatherWidgetGeo />

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Overview metrics"
      >
        <StatCard
          label="Tables"
          value={String(tableCount)}
          delta="Live schema"
          icon={Database}
        />
        <StatCard
          label="Records"
          value={String(recordCount)}
          delta="Across all tables"
          icon={BarChart3}
        />
        <StatCard
          label="Automations"
          value={String(automationCount)}
          delta="Active and draft"
          icon={Workflow}
        />
        <StatCard
          label="Chat Threads"
          value={String(threadCount)}
          delta="Team + assistant"
          icon={MessageSquare}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">Quick Access</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/data"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4 text-sm text-[var(--text)]"
            >
              Manage tables and records
            </Link>
            <Link
              href="/automations"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4 text-sm text-[var(--text)]"
            >
              Build and run automations
            </Link>
            <Link
              href="/assistant"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4 text-sm text-[var(--text)]"
            >
              Generate automation drafts
            </Link>
            <Link
              href="/admin"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4 text-sm text-[var(--text)]"
            >
              Review audit logs and members
            </Link>
            <Link
              href="/activity"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4 text-sm text-[var(--text)]"
            >
              Open activity feed
            </Link>
            <Link
              href="/reports"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4 text-sm text-[var(--text)]"
            >
              Export reports
            </Link>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">
            Recent Audit Events
          </h2>
          <ul className="space-y-2">
            {recentAudit.map((entry) => (
              <li
                key={entry.id}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{entry.action}</span>
                  <Badge variant="default">{entry.entityType}</Badge>
                </div>
              </li>
            ))}
            {recentAudit.length === 0 ? (
              <li className="text-sm text-[var(--text-muted)]">
                No audit logs yet.
              </li>
            ) : null}
          </ul>
        </GlassCard>
      </section>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Notifications</h2>
        <ul className="space-y-2">
          {recentNotifications.map((notification) => (
            <li
              key={notification.id}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2"
            >
              <p className="text-sm text-[var(--text)]">{notification.title}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {notification.body}
              </p>
            </li>
          ))}
          {recentNotifications.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">
              No notifications available.
            </li>
          ) : null}
        </ul>
      </GlassCard>
    </div>
  );
}
