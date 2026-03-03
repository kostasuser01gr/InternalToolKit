import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

const querySchema = z.object({
  workspaceId: z.string().min(1),
  includeResolved: z.enum(["0", "1"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    includeResolved: searchParams.get("includeResolved") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "Invalid query.", status: 400 });
  }

  try {
    await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN", "EDITOR"]);

    const rows = await db.deadLetterEntry.findMany({
      where: {
        ...(parsed.data.workspaceId ? { workspaceId: parsed.data.workspaceId } : {}),
        ...(parsed.data.includeResolved === "1"
          ? {}
          : {
              resolvedAt: null,
              ignoredAt: null,
            }),
      },
      orderBy: [{ lastAttempt: "desc" }, { createdAt: "desc" }],
      take: parsed.data.limit ?? 100,
    });

    const summary = {
      open: rows.filter((row) => !row.resolvedAt && !row.ignoredAt).length,
      resolved: rows.filter((row) => !!row.resolvedAt).length,
      ignored: rows.filter((row) => !!row.ignoredAt).length,
    };

    return apiSuccess({ items: rows, summary }, { requestId, status: 200 });
  } catch (error) {
    return apiError({
      requestId,
      code: "DEAD_LETTER_LIST_FAILED",
      message: error instanceof Error ? error.message : "Failed to list dead-letter entries.",
      status: 500,
    });
  }
}
