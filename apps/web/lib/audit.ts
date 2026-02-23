import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/lib/convex-api";
import { appendDemoEvent } from "@/lib/demo-events";

export async function appendAuditLog(params: {
  workspaceId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metaJson?: Prisma.JsonValue;
  source?: "server-action" | "api";
}) {
  appendDemoEvent({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    actorUserId: params.actorUserId ?? null,
    source: params.source ?? "server-action",
    meta:
      (params.metaJson && typeof params.metaJson === "object"
        ? (params.metaJson as Record<string, unknown>)
        : {}) ?? {},
  });

  const convex = getConvexClient();
  if (convex) {
    return convex.mutation(api.auditLogs.create, {
      workspaceId: params.workspaceId,
      ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metaJson: params.metaJson ?? {},
    });
  }

  return db.auditLog.create({
    data: {
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metaJson: params.metaJson ?? {},
    },
  });
}
