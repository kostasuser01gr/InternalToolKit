"use client";

import { useOptimistic, useTransition } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { markNotificationReadAction } from "./actions";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const [optimistic, setOptimistic] = useOptimistic(
    notifications,
    (state, readId: string) =>
      state.map((n) => (n.id === readId ? { ...n, readAt: new Date() } : n)),
  );
  const [, startTransition] = useTransition();

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      setOptimistic(id);
      const fd = new FormData();
      fd.set("notificationId", id);
      try {
        await markNotificationReadAction(fd);
      } catch {
        // Server action handles redirect on DB error; optimistic update remains
      }
    });
  };

  return (
    <ul className="space-y-2">
      {optimistic.map((notification) => (
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkRead(notification.id)}
              >
                <Bell className="size-3.5" />
                Mark read
              </Button>
            )}
          </div>
        </li>
      ))}
      {optimistic.length === 0 ? (
        <li className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-6 text-sm text-[var(--text-muted)]">
          No notifications yet. Run demo actions or automations to populate this feed.
        </li>
      ) : null}
    </ul>
  );
}
