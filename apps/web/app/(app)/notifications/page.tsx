import { GlassCard } from "@/components/kit/glass-card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { withDbFallback } from "@/lib/prisma-errors";

import {
  markAllNotificationsReadAction,
} from "./actions";
import { NotificationsList } from "./notifications-list";

type NotificationsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const { user } = await getAppContext();

  const notifications = await withDbFallback(db.notification.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 120,
  }), []);

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

        <NotificationsList notifications={notifications} />
      </GlassCard>
    </div>
  );
}
