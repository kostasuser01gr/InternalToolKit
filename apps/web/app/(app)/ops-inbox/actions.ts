"use server";

import { WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { withDbAction } from "@/lib/prisma-errors";
import { requireWorkspaceRole } from "@/lib/rbac";

/** Acknowledge a high-relevance feed item (unpin + mark as reviewed) */
export async function ackFeedItemAction(formData: FormData) {
  return withDbAction(async () => {
    const workspaceId = formData.get("workspaceId") as string;
    const feedItemId = formData.get("feedItemId") as string;

    if (!workspaceId || !feedItemId) return;

    const { user } = await requireWorkspaceRole(workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const item = await db.feedItem.findFirst({
      where: { id: feedItemId, workspaceId },
    });

    if (!item) return;

    await db.feedItem.update({
      where: { id: feedItemId },
      data: { isPinned: false },
    });

    await appendAuditLog({
      workspaceId,
      actorUserId: user.id,
      action: "feed_item.acknowledged",
      entityType: "feedItem",
      entityId: feedItemId,
      metaJson: { title: item.title.slice(0, 80) },
    });

    revalidatePath("/ops-inbox");
  }, "/ops-inbox");
}

/** Dismiss (mark read) a notification from ops inbox */
export async function dismissNotificationAction(formData: FormData) {
  return withDbAction(async () => {
    const notificationId = formData.get("notificationId") as string;
    const workspaceId = formData.get("workspaceId") as string;

    if (!notificationId || !workspaceId) return;

    await requireWorkspaceRole(workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
    ]);

    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    revalidatePath("/ops-inbox");
  }, "/ops-inbox");
}

/** Create a new incident from ops inbox */
export async function createIncidentAction(formData: FormData) {
  return withDbAction(async () => {
    const workspaceId = formData.get("workspaceId") as string;
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const severity = (formData.get("severity") as string) || "MEDIUM";
    const vehicleId = (formData.get("vehicleId") as string) || null;

    if (!workspaceId || !title) return;

    const { user } = await requireWorkspaceRole(workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
    ]);

    const incident = await db.incident.create({
      data: {
        workspaceId,
        reportedBy: user.id,
        title,
        description,
        severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        vehicleId,
      },
    });

    await appendAuditLog({
      workspaceId,
      actorUserId: user.id,
      action: "incident.created",
      entityType: "incident",
      entityId: incident.id,
      metaJson: { title, severity },
    });

    revalidatePath("/ops-inbox");
  }, "/ops-inbox");
}

/** Resolve an incident */
export async function resolveIncidentAction(formData: FormData) {
  return withDbAction(async () => {
    const workspaceId = formData.get("workspaceId") as string;
    const incidentId = formData.get("incidentId") as string;

    if (!workspaceId || !incidentId) return;

    const { user } = await requireWorkspaceRole(workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    await db.incident.update({
      where: { id: incidentId },
      data: { resolvedAt: new Date(), status: "RESOLVED" },
    });

    await appendAuditLog({
      workspaceId,
      actorUserId: user.id,
      action: "incident.resolved",
      entityType: "incident",
      entityId: incidentId,
    });

    revalidatePath("/ops-inbox");
  }, "/ops-inbox");
}
