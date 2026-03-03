import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateSchema = z.object({
  workspaceId: z.string().min(1),
  enabled: z.boolean().optional(),
  rolloutRing: z.enum(["pilot", "region", "all"]).optional(),
  notes: z.string().trim().max(500).optional(),
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

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN", "EDITOR"]);

    const existing = await db.stationFeatureFlag.findFirst({
      where: {
        id,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!existing) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Feature flag not found.", status: 404 });
    }

    const item = await db.stationFeatureFlag.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        ...(parsed.data.rolloutRing !== undefined ? { rolloutRing: parsed.data.rolloutRing } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      },
    });

    return apiSuccess({ item }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "FEATURE_FLAG_UPDATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to update feature flag.",
      status: 500,
    });
  }
}
