import { createHash } from "crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

const querySchema = z.object({
  workspaceId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid query.",
      },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  }

  try {
    await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN"]);

    const rows = await db.auditLog.findMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        ...(parsed.data.from || parsed.data.to
          ? {
              createdAt: {
                ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
                ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      take: parsed.data.limit ?? 5000,
    });

    const ndjson = rows.map((row) => JSON.stringify(row)).join("\n");
    const hash = createHash("sha256").update(ndjson).digest("hex");

    const response = new Response(ndjson, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"audit-export-${parsed.data.workspaceId}.ndjson\"`,
        "X-Audit-Export-Hash": hash,
        "X-Audit-Export-Immutable": "true",
      },
    });

    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to export audit logs.",
      },
      withObservabilityHeaders({ status: 500 }, requestId),
    );
  }
}
