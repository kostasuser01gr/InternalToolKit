import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const actionSchema = z.object({
  workspaceId: z.string().min(1),
  action: z.enum(["retry", "ignore", "assign", "resolve"]),
  ownerUserId: z.string().min(1).optional(),
  note: z.string().trim().max(400).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    const { user } = await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN", "EDITOR"]);

    const entry = await db.deadLetterEntry.findFirst({
      where: {
        id,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!entry) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Dead-letter entry not found.", status: 404 });
    }

    const now = new Date();
    const updated = await db.deadLetterEntry.update({
      where: { id: entry.id },
      data:
        parsed.data.action === "retry"
          ? {
              attempts: entry.attempts + 1,
              lastAttempt: now,
              resolvedAt: null,
              ignoredAt: null,
            }
          : parsed.data.action === "ignore"
            ? {
                ignoredAt: now,
                resolvedAt: now,
              }
            : parsed.data.action === "resolve"
              ? {
                  resolvedAt: now,
                  ignoredAt: null,
                }
              : {
                  ownerUserId: parsed.data.ownerUserId ?? null,
                },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: `dead_letter.${parsed.data.action}`,
      entityType: "dead_letter_entry",
      entityId: updated.id,
      metaJson: {
        ownerUserId: parsed.data.ownerUserId ?? null,
        note: parsed.data.note ?? null,
      },
      source: "api",
    });

    return apiSuccess({ item: updated }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "DEAD_LETTER_ACTION_FAILED",
      message: error instanceof Error ? error.message : "Failed to update dead-letter entry.",
      status: 500,
    });
  }
}
