import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { GlassCard } from "@/components/kit/glass-card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

type NotificationsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const { user } = await getAppContext();

  const notifications = await db.notification.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 120,
  });

  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  return (
    <div className="page-stack" data-testid="notifications-page">
      <PageHeader
        title="Notifications"
        subtitle="Historical in-app notification feed for operational events and assistant activity."
        action={
          unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      <StatusBanner error={params.error} success={params.success} />

      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-xl font-semibold">History</h2>
          <Badge variant={unreadCount > 0 ? "active" : "default"}>
            {unreadCount} unread
          </Badge>
        </div>

        <ul className="space-y-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {notification.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                  </p>
                </div>
                {notification.readAt ? (
                  <Badge variant="default">Read</Badge>
                ) : (
                  <form action={markNotificationReadAction}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      <Bell className="size-3.5" />
                      Mark read
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
          {notifications.length === 0 ? (
            <li className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-6 text-sm text-[var(--text-muted)]">
              No notifications yet. Run demo actions or automations to populate this feed.
            </li>
          ) : null}
        </ul>
      </GlassCard>
    </div>
  );
}
