import { formatDistanceToNow } from "date-fns";

import { DataTable } from "@/components/kit/data-table";
import { FilterBar } from "@/components/kit/filter-bar";
import { GlassCard } from "@/components/kit/glass-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { listDemoEvents } from "@/lib/demo-events";

type ActivityPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    q?: string;
    from?: string;
    to?: string;
    period?: "week" | "month" | "year";
    actor?: string;
  }>;
};

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext(params.workspaceId);

  const from = parseDate(params.from);
  const to = parseDate(params.to);
  const q = params.q?.trim().toLowerCase();

  const auditEntries = await db.auditLog.findMany({
    where: {
      workspaceId: workspace.id,
      ...(params.actor ? { actorUserId: params.actor } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  const filteredAuditEntries = q
    ? auditEntries.filter((entry) =>
        `${entry.action} ${entry.entityType} ${entry.entityId}`
          .toLowerCase()
          .includes(q),
      )
    : auditEntries;

  const memoryEvents = listDemoEvents(200).filter((event) => {
    if (q) {
      const index = `${event.action} ${event.entityType} ${event.entityId}`
        .toLowerCase()
        .includes(q);
      if (!index) {
        return false;
      }
    }

    if (from && new Date(event.createdAt) < from) {
      return false;
    }

    if (to && new Date(event.createdAt) > to) {
      return false;
    }

    if (params.actor && event.actorUserId !== params.actor) {
      return false;
    }

    return true;
  });

  return (
    <div className="page-stack" data-testid="activity-page">
      <PageHeader
        title="Activity"
        subtitle="Unified feed of in-memory demo events and persisted audit entries for internal operations."
      />

      <FilterBar
        defaultQuery={params.q}
        defaultFrom={params.from}
        defaultTo={params.to}
        defaultPeriod={params.period ?? "week"}
        hiddenFields={[{ name: "workspaceId", value: workspace.id }]}
      />

      <GlassCard className="space-y-3">
        <form className="grid gap-2 md:grid-cols-[220px,auto]">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <input type="hidden" name="q" value={params.q ?? ""} />
          <input type="hidden" name="from" value={params.from ?? ""} />
          <input type="hidden" name="to" value={params.to ?? ""} />
          <div className="space-y-1">
            <Label htmlFor="actor">Actor user id</Label>
            <Input id="actor" name="actor" defaultValue={params.actor} />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/8 px-3 py-2 text-sm text-[var(--text)]"
            >
              Filter actor
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-xl font-semibold">Live Activity Feed</h2>
          <Badge variant="active">{memoryEvents.length}</Badge>
        </div>
        <DataTable
          columns={[
            { key: "time", label: "Time" },
            { key: "action", label: "Action" },
            { key: "entity", label: "Entity" },
            { key: "actor", label: "Actor" },
            { key: "source", label: "Source" },
          ]}
          rows={memoryEvents.map((event) => ({
            id: event.id,
            cells: [
              formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }),
              event.action,
              `${event.entityType}:${event.entityId}`,
              event.actorUserId ?? "system",
              <Badge key={`${event.id}-source`} variant="default">
                {event.source}
              </Badge>,
            ],
          }))}
          emptyTitle="No demo events yet."
          emptyDescription="Trigger actions from command palette or feature pages to populate this feed."
        />
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-xl font-semibold">Audit Trail</h2>
          <Badge variant="default">{filteredAuditEntries.length}</Badge>
        </div>
        <DataTable
          columns={[
            { key: "time", label: "Time" },
            { key: "action", label: "Action" },
            { key: "entity", label: "Entity" },
            { key: "actor", label: "Actor" },
          ]}
          rows={filteredAuditEntries.map((entry) => ({
            id: entry.id,
            cells: [
              formatDistanceToNow(entry.createdAt, { addSuffix: true }),
              entry.action,
              `${entry.entityType}:${entry.entityId}`,
              entry.actor?.email ?? "system",
            ],
          }))}
          emptyTitle="No audit logs for current filters."
        />
      </GlassCard>
    </div>
  );
}
