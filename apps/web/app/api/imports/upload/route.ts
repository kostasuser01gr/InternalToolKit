import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

import { getRequestId, logWebRequest, withObservabilityHeaders } from "@/lib/http-observability";
import { db } from "@/lib/db";
import { requireAdminAccess } from "@/lib/rbac";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { parseFileBuffer, applyMappings } from "@/lib/imports/file-parser";
import { computeDiff } from "@/lib/imports/diff-engine";
import { findTemplate } from "@/lib/imports/templates";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const start = Date.now();

  try {
    const formData = await request.formData();
    const workspaceId = formData.get("workspaceId") as string;
    const importType = (formData.get("importType") as string) || "other";
    const file = formData.get("file") as File | null;

    if (!workspaceId || !file) {
      return Response.json(
        { error: "Missing workspaceId or file" },
        withObservabilityHeaders({ status: 400 }, requestId),
      );
    }

    const { user } = await requireAdminAccess(workspaceId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);

    // Idempotency check
    const existing = await db.importBatch.findUnique({
      where: { workspaceId_fileHash: { workspaceId, fileHash } },
    });

    if (existing && !["DECLINED", "ROLLED_BACK", "FAILED"].includes(existing.status)) {
      return Response.json(
        { error: `File already imported (batch ${existing.id}, status ${existing.status})`, batchId: existing.id },
        withObservabilityHeaders({ status: 409 }, requestId),
      );
    }

    // Parse file content
    const template = findTemplate(importType);
    const parsed = parseFileBuffer(buffer, file.type, file.name, template?.sheetName);

    // Apply mappings if template exists
    let mappedRows = parsed.rows;
    if (template && parsed.rows.length > 0) {
      mappedRows = applyMappings(parsed.rows, template.mappings);
    }

    // Compute diff against existing records (for fleet imports)
    let diffSummary = null;
    if (importType === "fleet" && mappedRows.length > 0) {
      const vehicles = await db.vehicle.findMany({
        where: { workspaceId },
        select: { id: true, plateNumber: true, model: true, mileageKm: true, fuelPercent: true, notes: true },
      });
      const existingMap = new Map(
        vehicles.map((v) => [v.plateNumber, { id: v.id, plateNumber: v.plateNumber, model: v.model, mileage: v.mileageKm, fuelLevel: v.fuelPercent, notes: v.notes }]),
      );
      diffSummary = computeDiff(mappedRows, existingMap, "plateNumber");
    }

    const batch = await db.importBatch.create({
      data: {
        workspaceId,
        createdBy: user.id,
        importType,
        fileName: file.name,
        fileHash,
        fileSizeBytes: buffer.length,
        status: diffSummary ? "PREVIEW" : "ANALYZING",
        mappingJson: template ? (template.mappings as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        previewJson: {
          rawBase64: buffer.toString("base64").slice(0, 500_000),
          contentType: file.type,
          headers: parsed.headers,
          rowCount: parsed.rows.length,
          parseErrors: parsed.errors,
          sheetName: parsed.sheetName,
        },
        diffSummary: diffSummary ? ({
          totalRows: diffSummary.totalRows,
          creates: diffSummary.creates,
          updates: diffSummary.updates,
          archives: diffSummary.archives,
          skips: diffSummary.skips,
          errors: diffSummary.errors,
          records: diffSummary.records,
        } as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    logWebRequest({
      event: "import.upload",
      requestId,
      route: "/api/imports/upload",
      method: "POST",
      status: 201,
      durationMs: Date.now() - start,
    });

    return Response.json(
      {
        batchId: batch.id,
        status: batch.status,
        fileName: file.name,
        rowCount: parsed.rows.length,
        parseErrors: parsed.errors,
        diff: diffSummary ? {
          creates: diffSummary.creates,
          updates: diffSummary.updates,
          skips: diffSummary.skips,
          errors: diffSummary.errors,
        } : null,
      },
      withObservabilityHeaders({ status: 201 }, requestId),
    );
  } catch (err) {
    if (isSchemaNotReadyError(err)) {
      return Response.json(
        { error: "Imports module not ready — migrations may be pending." },
        withObservabilityHeaders({ status: 503 }, requestId),
      );
    }

    logWebRequest({
      event: "import.upload.error",
      requestId,
      route: "/api/imports/upload",
      method: "POST",
      status: 500,
      durationMs: Date.now() - start,
    });

    return Response.json(
      { error: "Upload failed" },
      withObservabilityHeaders({ status: 500 }, requestId),
    );
  }
}
