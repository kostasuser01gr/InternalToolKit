import { Prisma } from "@prisma/client";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { applyMappings, parseFileBuffer } from "@/lib/imports/file-parser";
import { computeDiff } from "@/lib/imports/diff-engine";
import { findTemplate } from "@/lib/imports/templates";
import { requireAdminAccess } from "@/lib/rbac";

const simulateSchema = z.object({
  workspaceId: z.string().min(1),
  batchId: z.string().min(1),
});

function toColumnConfidence(rows: Record<string, unknown>[], mapping: Array<{ sourceColumn: string; targetField: string }>) {
  const totalRows = rows.length;
  return mapping.map((item) => {
    const nonEmptyCount = rows.reduce((count, row) => {
      const value = row[item.sourceColumn];
      if (value === null || value === undefined) return count;
      const normalized = String(value).trim();
      return normalized.length > 0 ? count + 1 : count;
    }, 0);

    return {
      sourceColumn: item.sourceColumn,
      targetField: item.targetField,
      confidence: totalRows > 0 ? Number((nonEmptyCount / totalRows).toFixed(3)) : 0,
    };
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = simulateSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    await requireAdminAccess(parsed.data.workspaceId);

    const batch = await db.importBatch.findFirst({
      where: {
        id: parsed.data.batchId,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!batch) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Import batch not found.", status: 404 });
    }

    const preview = (batch.previewJson ?? null) as {
      rawBase64?: string;
      contentType?: string;
      headers?: string[];
      sheetName?: string;
    } | null;

    if (!preview?.rawBase64) {
      return apiError({
        requestId,
        code: "BATCH_NOT_READY",
        message: "Batch preview payload is missing.",
        status: 409,
      });
    }

    const fileBuffer = Buffer.from(preview.rawBase64, "base64");
    const template = findTemplate(batch.importType);
    const parsedFile = parseFileBuffer(
      fileBuffer,
      preview.contentType ?? "application/octet-stream",
      batch.fileName,
      template?.sheetName,
    );

    let mappedRows = parsedFile.rows;
    if (template && parsedFile.rows.length > 0) {
      mappedRows = applyMappings(parsedFile.rows, template.mappings);
    }

    let diffSummary: ReturnType<typeof computeDiff> | null = null;

    if (batch.importType === "fleet") {
      const vehicles = await db.vehicle.findMany({
        where: { workspaceId: parsed.data.workspaceId },
        select: {
          id: true,
          plateNumber: true,
          model: true,
          mileageKm: true,
          fuelPercent: true,
          notes: true,
        },
      });

      const existingMap = new Map(
        vehicles.map((vehicle) => [
          vehicle.plateNumber,
          {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            model: vehicle.model,
            mileage: vehicle.mileageKm,
            fuelLevel: vehicle.fuelPercent,
            notes: vehicle.notes,
          },
        ]),
      );

      diffSummary = computeDiff(mappedRows, existingMap, "plateNumber");
    }

    const mappingForConfidence = template?.mappings.map((item) => ({
      sourceColumn: item.sourceColumn,
      targetField: item.targetField,
    })) ?? [];

    const confidence = toColumnConfidence(parsedFile.rows, mappingForConfidence);

    await db.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "PREVIEW",
        diffSummary: diffSummary
          ? (JSON.parse(JSON.stringify({
              totalRows: diffSummary.totalRows,
              creates: diffSummary.creates,
              updates: diffSummary.updates,
              archives: diffSummary.archives,
              skips: diffSummary.skips,
              errors: diffSummary.errors,
              records: diffSummary.records,
            })) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    return apiSuccess(
      {
        batchId: batch.id,
        status: "PREVIEW",
        rowCount: parsedFile.rows.length,
        parseErrors: parsedFile.errors,
        confidence,
        diff: diffSummary
          ? {
              totalRows: diffSummary.totalRows,
              creates: diffSummary.creates,
              updates: diffSummary.updates,
              archives: diffSummary.archives,
              skips: diffSummary.skips,
              errors: diffSummary.errors,
            }
          : null,
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed.";
    return apiError({ requestId, code: "SIMULATION_FAILED", message, status: 500 });
  }
}
