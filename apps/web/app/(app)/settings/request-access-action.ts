"use server";

import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

/**
 * Request access to a governance setting/feature.
 * Creates a ChatMessage in the workspace's general thread addressed to admins,
 * and logs an audit event.
 */
export async function requestAccessAction(formData: FormData) {
  const feature = formData.get("feature")?.toString() ?? "Unknown setting";
  const reason = formData.get("reason")?.toString() ?? "";

  const { user, workspace, workspaceRole } = await getAppContext();

  const message = `🔑 **Access Request** from ${user.name ?? user.email}
Feature: **${feature}**
Role: ${workspaceRole}
${reason ? `Reason: ${reason}` : ""}

_This request was generated automatically. Please review and respond._`;

  try {
    // Try to post to a general chat thread if one exists
    const thread = await db.chatThread.findFirst({
      where: {
        workspaceId: workspace.id,
        title: { contains: "general", mode: "insensitive" },
      },
    });

    if (thread) {
      await db.chatMessage.create({
        data: {
          threadId: thread.id,
          role: "USER",
          content: message,
          authorUserId: user.id,
          modelId: "system",
          status: "COMPLETED",
          tokenUsage: 0,
          latencyMs: 0,
        },
      });
    }
  } catch (err) {
    if (!isDatabaseUnavailableError(err)) {
      console.error("Failed to create access request message:", err);
    }
  }

  // Always log the audit event
  await appendAuditLog({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: "settings.access_requested",
    entityType: "setting",
    entityId: feature,
    metaJson: { feature, reason, role: workspaceRole },
    source: "server-action",
  });

  revalidatePath("/settings");
  revalidatePath("/chat");
}
