import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

const querySchema = z.object({
  workspaceId: z.string().min(1),
  stationId: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
});

const createSchema = z.object({
  workspaceId: z.string().min(1),
  stationId: z.string().min(1),
  key: z.string().trim().min(2).max(100),
  enabled: z.boolean().optional(),
  rolloutRing: z.enum(["pilot", "region", "all"]).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    stationId: searchParams.get("stationId") ?? undefined,
    key: searchParams.get("key") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "Invalid query.", status: 400 });
  }

  try {
    await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN", "EDITOR"]);

    const items = await db.stationFeatureFlag.findMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        ...(parsed.data.stationId ? { stationId: parsed.data.stationId } : {}),
        ...(parsed.data.key ? { key: parsed.data.key } : {}),
      },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ key: "asc" }, { createdAt: "desc" }],
    });

    return apiSuccess({ items }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "FEATURE_FLAGS_LIST_FAILED",
      message: error instanceof Error ? error.message : "Failed to list feature flags.",
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
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

    const item = await db.stationFeatureFlag.upsert({
      where: {
        workspaceId_stationId_key: {
          workspaceId: parsed.data.workspaceId,
          stationId: parsed.data.stationId,
          key: parsed.data.key,
        },
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        stationId: parsed.data.stationId,
        key: parsed.data.key,
        enabled: parsed.data.enabled ?? false,
        rolloutRing: parsed.data.rolloutRing ?? "pilot",
        notes: parsed.data.notes ?? null,
      },
      update: {
        enabled: parsed.data.enabled ?? false,
        rolloutRing: parsed.data.rolloutRing ?? "pilot",
        notes: parsed.data.notes ?? null,
      },
    });

    return apiSuccess({ item }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "FEATURE_FLAG_UPSERT_FAILED",
      message: error instanceof Error ? error.message : "Failed to save feature flag.",
      status: 500,
    });
  }
}
