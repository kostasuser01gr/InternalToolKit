import { ShiftRequestStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

import { GlassCard } from "@/components/kit/glass-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

function schemaFallback<T>(fallback: T) {
  return (err: unknown): T => {
    if (!isSchemaNotReadyError(err)) throw err;
    return fallback;
  };
}

type OpsInboxProps = {
  searchParams: Promise<{
    workspaceId?: string;
  }>;
};

export default async function OpsInboxPage({ searchParams }: OpsInboxProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext(params.workspaceId);

  const [highRelevanceFeeds, pendingShiftRequests, recentIncidents, unreadNotifications] =
    await Promise.all([
      db.feedItem
        .findMany({
          where: {
            workspaceId: workspace.id,
            relevanceScore: { gte: 0.6 },
          },
          include: { source: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
        .catch(schemaFallback([])),

      db.shiftRequest
        .findMany({
          where: {
            workspaceId: workspace.id,
            status: ShiftRequestStatus.PENDING,
          },
          include: { requester: true, shift: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
        .catch(schemaFallback([])),

      db.incident
        .findMany({
          where: {
            workspaceId: workspace.id,
            resolvedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
        .catch(schemaFallback([])),

      // Get workspace member IDs first, then filter notifications
      db.workspaceMember
        .findMany({
          where: { workspaceId: workspace.id },
          select: { userId: true },
        })
        .then((members) =>
          db.notification.findMany({
            where: {
              userId: { in: members.map((m) => m.userId) },
              readAt: null,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
        )
        .catch(schemaFallback([])),
    ]);

  const totalItems =
    highRelevanceFeeds.length +
    pendingShiftRequests.length +
    recentIncidents.length +
    unreadNotifications.length;

  return (
    <div className="space-y-6" data-testid="ops-inbox-page">
      <PageHeader
        title="Ops Inbox"
        subtitle="Unified view of alerts, approvals, and high-priority items requiring attention."
      />

      <div className="flex items-center gap-3">
        <Badge variant={totalItems > 0 ? "danger" : "success"}>
          {totalItems} items
        </Badge>
        <span className="text-sm text-[var(--text-muted)]">
          {totalItems === 0
            ? "All clear — no items need attention."
            : `${totalItems} items need your attention.`}
        </span>
      </div>

      {/* Pending Shift Requests */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-lg font-semibold">
            ⏱ Pending Shift Requests
          </h2>
          <Badge variant={pendingShiftRequests.length > 0 ? "danger" : "default"}>
            {pendingShiftRequests.length}
          </Badge>
        </div>
        {pendingShiftRequests.length > 0 ? (
          <div className="space-y-2">
            {pendingShiftRequests.map((req) => (
              <a
                key={req.id}
                href={`/shifts?workspaceId=${workspace.id}`}
                className="focus-ring block rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 hover:bg-white/8"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {req.type} — {req.requester.name}
                  </p>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatDistanceToNow(req.createdAt, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{req.reason}</p>
                {req.shift ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    Linked: {req.shift.title}
                  </p>
                ) : null}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No pending requests.</p>
        )}
      </GlassCard>

      {/* Open Incidents */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-lg font-semibold">
            🚨 Open Incidents
          </h2>
          <Badge variant={recentIncidents.length > 0 ? "danger" : "default"}>
            {recentIncidents.length}
          </Badge>
        </div>
        {recentIncidents.length > 0 ? (
          <div className="space-y-2">
            {recentIncidents.map((incident) => (
              <div
                key={incident.id}
                className="rounded-[var(--radius-sm)] border border-red-500/20 bg-red-500/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {incident.title}
                  </p>
                  <Badge variant="danger">{incident.severity}</Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {incident.description?.slice(0, 120)}
                  {(incident.description?.length ?? 0) > 120 ? "…" : ""}
                </p>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatDistanceToNow(incident.createdAt, { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No open incidents.</p>
        )}
      </GlassCard>

      {/* High-Relevance Feed Items */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-lg font-semibold">
            📰 High-Relevance Feed Items
          </h2>
          <Badge variant={highRelevanceFeeds.length > 0 ? "active" : "default"}>
            {highRelevanceFeeds.length}
          </Badge>
        </div>
        {highRelevanceFeeds.length > 0 ? (
          <div className="space-y-2">
            {highRelevanceFeeds.map((item) => (
              <a
                key={item.id}
                href={`/feeds?workspaceId=${workspace.id}`}
                className="focus-ring block rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 hover:bg-white/8"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {item.title}
                  </p>
                  <span className="text-xs tabular-nums text-amber-400">
                    Score: {item.relevanceScore.toFixed(1)}
                  </span>
                </div>
                {item.summary ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.summary.slice(0, 150)}
                    {item.summary.length > 150 ? "…" : ""}
                  </p>
                ) : null}
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="default">{item.category}</Badge>
                  <span className="text-xs text-[var(--text-muted)]">
                    {item.source?.name ?? "Unknown source"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No high-relevance items. All feeds are routine.
          </p>
        )}
      </GlassCard>

      {/* Unread Notifications */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-lg font-semibold">
            🔔 Unread Notifications
          </h2>
          <Badge variant={unreadNotifications.length > 0 ? "active" : "default"}>
            {unreadNotifications.length}
          </Badge>
        </div>
        {unreadNotifications.length > 0 ? (
          <div className="space-y-2">
            {unreadNotifications.map((notif) => (
              <a
                key={notif.id}
                href={`/notifications`}
                className="focus-ring block rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 hover:bg-white/8"
              >
                <p className="text-sm font-medium text-[var(--text)]">{notif.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{notif.body}</p>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">All caught up.</p>
        )}
      </GlassCard>
    </div>
  );
}
