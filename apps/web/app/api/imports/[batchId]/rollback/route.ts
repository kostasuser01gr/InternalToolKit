import { ImportBatchStatus } from "@prisma/client";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { rollbackBatch } from "@/lib/imports/apply-engine";
import { requireAdminAccess } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

const rollbackPayloadSchema = z.object({
  workspaceId: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { batchId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = rollbackPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    const { user } = await requireAdminAccess(parsed.data.workspaceId);

    const batch = await db.importBatch.findFirst({
      where: {
        id: batchId,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!batch) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Import batch not found.", status: 404 });
    }

    if (batch.status !== ImportBatchStatus.APPLIED) {
      return apiError({
        requestId,
        code: "INVALID_BATCH_STATUS",
        message: `Batch status ${batch.status} cannot be rolled back.`,
        status: 409,
      });
    }

    const result = await rollbackBatch(db, batch.id);

    await db.importBatch.update({
      where: { id: batch.id },
      data: {
        status: ImportBatchStatus.ROLLED_BACK,
        rolledBackAt: new Date(),
        errorLog:
          result.errors.length > 0
            ? `Rollback: ${result.reverted} reverted, ${result.errors.length} errors: ${result.errors.join("; ")}`
            : null,
      },
    });

    await appendAuditLog({
      workspaceId: batch.workspaceId,
      actorUserId: user.id,
      action: "import.batch_rolled_back",
      entityType: "import_batch",
      entityId: batch.id,
      metaJson: {
        reverted: result.reverted,
        errors: result.errors.length,
      },
      source: "api",
    });

    return apiSuccess(
      {
        batchId: batch.id,
        reverted: result.reverted,
        errors: result.errors,
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollback failed.";
    return apiError({ requestId, code: "ROLLBACK_FAILED", message, status: 500 });
  }
}
