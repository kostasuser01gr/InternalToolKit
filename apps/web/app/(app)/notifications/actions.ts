"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";

const markSchema = z.object({
  notificationId: z.string().min(1),
});

function buildNotificationsUrl(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

export async function markNotificationReadAction(formData: FormData) {
  const parsed = markSchema.parse({
    notificationId: formData.get("notificationId"),
  });

  try {
    const { user, workspace } = await getAppContext();

    const notification = await db.notification.findFirst({
      where: {
        id: parsed.notificationId,
        userId: user.id,
      },
    });

    if (!notification) {
      throw new Error("Notification not found.");
    }

    await db.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
    });

    await appendAuditLog({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "notification.read",
      entityType: "notification",
      entityId: notification.id,
      metaJson: {},
    });

    revalidatePath("/notifications");
    redirect(buildNotificationsUrl({ success: "Notification marked as read." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildNotificationsUrl({
        error: error instanceof Error ? error.message : "Unexpected error.",
      }),
    );
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const { user, workspace } = await getAppContext();

    await db.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    await appendAuditLog({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "notification.read_all",
      entityType: "notification",
      entityId: user.id,
      metaJson: {},
    });

    revalidatePath("/notifications");
    redirect(buildNotificationsUrl({ success: "All notifications marked as read." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildNotificationsUrl({
        error: error instanceof Error ? error.message : "Unexpected error.",
      }),
    );
  }
}
