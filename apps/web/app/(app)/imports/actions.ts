"use server";

import { ImportBatchStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { withDbAction } from "@/lib/prisma-errors";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireAdminAccess } from "@/lib/rbac";
import { parseFileBuffer, applyMappings } from "@/lib/imports/file-parser";
import { computeDiff } from "@/lib/imports/diff-engine";
import { findTemplate } from "@/lib/imports/templates";
import {
  createImportBatchSchema,
  updateMappingSchema,
  acceptImportSchema,
  declineImportSchema,
  rollbackImportSchema,
} from "@/lib/validators/imports";

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const s = query.toString();
  return s ? `${base}?${s}` : base;
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}

export async function uploadImportAction(formData: FormData) {
  return withDbAction(async () => {
    const workspaceId = formData.get("workspaceId") as string;
    const importType = (formData.get("importType") as string) || "other";
    const file = formData.get("file") as File | null;

    if (!workspaceId || !file || file.size === 0) {
      redirect(buildUrl("/imports", { error: "Please select a non-empty file to upload." }));
    }

    try {
      const { user } = await requireAdminAccess(workspaceId);
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileHash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);

      // Idempotency check
      const existing = await db.importBatch.findUnique({
        where: { workspaceId_fileHash: { workspaceId, fileHash } },
      });

      if (existing && !["DECLINED", "ROLLED_BACK", "FAILED"].includes(existing.status)) {
        redirect(buildUrl("/imports", {
          error: `File already imported (batch ${existing.id}, status ${existing.status})`,
          batchId: existing.id
        }));
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

      await appendAuditLog({
        workspaceId,
        actorUserId: user.id,
        action: "import.upload",
        entityType: "import_batch",
        entityId: batch.id,
        metaJson: { importType, fileName: file.name },
      });

      revalidatePath("/imports");
      redirect(buildUrl("/imports", { success: `Upload successful. Batch ${batch.id} is ready for review.`, batchId: batch.id }));
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(buildUrl("/imports", { error: getErrorMessage(error) }));
    }
  }, "/imports");
}

export async function createImportBatchAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = createImportBatchSchema.parse({
      workspaceId: formData.get("workspaceId"),
      importType: formData.get("importType"),
      fileName: formData.get("fileName"),
      fileHash: formData.get("fileHash"),
      fileSizeBytes: formData.get("fileSizeBytes") || undefined,
      fileUrl: formData.get("fileUrl") || undefined,
    });

    try {
      const { user } = await requireAdminAccess(parsed.workspaceId);

      // Idempotency: check if same file hash already exists
      const existing = await db.importBatch.findUnique({
        where: {
          workspaceId_fileHash: {
            workspaceId: parsed.workspaceId,
            fileHash: parsed.fileHash,
          },
        },
      });

      if (existing && existing.status !== ImportBatchStatus.DECLINED && existing.status !== ImportBatchStatus.ROLLED_BACK) {
        redirect(buildUrl("/imports", {
          error: `This file was already imported (batch ${existing.id}, status: ${existing.status}). Decline or rollback the existing batch first.`,
        }));
      }

      const batch = await db.importBatch.create({
        data: {
          workspaceId: parsed.workspaceId,
          createdBy: user.id,
          importType: parsed.importType,
          fileName: parsed.fileName,
          fileHash: parsed.fileHash,
          fileSizeBytes: parsed.fileSizeBytes ?? null,
          fileUrl: parsed.fileUrl ?? null,
          status: ImportBatchStatus.UPLOADING,
        },
      });

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "import.batch_created",
        entityType: "import_batch",
        entityId: batch.id,
        metaJson: { importType: parsed.importType, fileName: parsed.fileName },
      });

      revalidatePath("/imports");
      redirect(buildUrl("/imports", { success: `Import batch created: ${batch.id}`, batchId: batch.id }));
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(buildUrl("/imports", { error: getErrorMessage(error) }));
    }
  }, "/imports");
}

export async function updateMappingAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = updateMappingSchema.parse({
      workspaceId: formData.get("workspaceId"),
      batchId: formData.get("batchId"),
      mappingJson: formData.get("mappingJson"),
    });

    try {
      const { user } = await requireAdminAccess(parsed.workspaceId);

      await db.importBatch.update({
        where: { id: parsed.batchId },
        data: {
          mappingJson: JSON.parse(parsed.mappingJson),
          status: ImportBatchStatus.PREVIEW,
        },
      });

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "import.mapping_updated",
        entityType: "import_batch",
        entityId: parsed.batchId,
        metaJson: {},
      });

      revalidatePath("/imports");
      redirect(buildUrl("/imports", { success: "Mapping updated. Review preview.", batchId: parsed.batchId }));
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(buildUrl("/imports", { error: getErrorMessage(error) }));
    }
  }, "/imports");
}

export async function acceptImportAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = acceptImportSchema.parse({
      workspaceId: formData.get("workspaceId"),
      batchId: formData.get("batchId"),
    });

    try {
      const { user } = await requireAdminAccess(parsed.workspaceId);

      const batch = await db.importBatch.findUniqueOrThrow({
        where: { id: parsed.batchId },
      });

      if (batch.status !== ImportBatchStatus.PREVIEW) {
        throw new Error(`Cannot accept batch in status ${batch.status}. Must be in PREVIEW.`);
      }

      // Mark as applying
      await db.importBatch.update({
        where: { id: parsed.batchId },
        data: { status: ImportBatchStatus.APPLYING },
      });

      // Apply the diff using stored diff summary
      const diffData = batch.diffSummary as unknown as import("@/lib/imports/diff-engine").DiffSummary | null;
      if (diffData && Array.isArray(diffData.records) && batch.importType === "fleet") {
        const { applyFleetDiff } = await import("@/lib/imports/apply-engine");
        const applyResult = await applyFleetDiff(db, batch.id, batch.workspaceId, diffData);

        if (applyResult.errors.length > 0) {
          await db.importBatch.update({
            where: { id: parsed.batchId },
            data: {
              status: ImportBatchStatus.APPLIED,
              appliedAt: new Date(),
              errorLog: `Applied ${applyResult.applied} records with ${applyResult.errors.length} errors: ${applyResult.errors.map((e) => `row ${e.rowIndex}: ${e.message}`).join("; ")}`,
            },
          });
        } else {
          await db.importBatch.update({
            where: { id: parsed.batchId },
            data: {
              status: ImportBatchStatus.APPLIED,
              appliedAt: new Date(),
            },
          });
        }
      } else if (diffData && Array.isArray(diffData.records) && batch.importType === "bookings") {
        const { applyBookingsDiff } = await import("@/lib/imports/apply-engine");
        const applyResult = await applyBookingsDiff(db, batch.id, batch.workspaceId, diffData, user.id);

        await db.importBatch.update({
          where: { id: parsed.batchId },
          data: {
            status: ImportBatchStatus.APPLIED,
            appliedAt: new Date(),
            errorLog: applyResult.errors.length > 0
              ? `Applied ${applyResult.applied} shifts with ${applyResult.errors.length} errors: ${applyResult.errors.map((e) => `row ${e.rowIndex}: ${e.message}`).join("; ")}`
              : null,
          },
        });
      } else {
        // Non-fleet imports or no preview data — mark as applied (no-op for unmapped types)
        await db.importBatch.update({
          where: { id: parsed.batchId },
          data: {
            status: ImportBatchStatus.APPLIED,
            appliedAt: new Date(),
          },
        });
      }

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "import.batch_accepted",
        entityType: "import_batch",
        entityId: parsed.batchId,
        metaJson: { importType: batch.importType },
      });

      revalidatePath("/imports");
      redirect(buildUrl("/imports", { success: "Import applied successfully." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(buildUrl("/imports", { error: getErrorMessage(error) }));
    }
  }, "/imports");
}

export async function declineImportAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = declineImportSchema.parse({
      workspaceId: formData.get("workspaceId"),
      batchId: formData.get("batchId"),
    });

    try {
      const { user } = await requireAdminAccess(parsed.workspaceId);

      await db.importBatch.update({
        where: { id: parsed.batchId },
        data: { status: ImportBatchStatus.DECLINED },
      });

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "import.batch_declined",
        entityType: "import_batch",
        entityId: parsed.batchId,
        metaJson: {},
      });

      revalidatePath("/imports");
      redirect(buildUrl("/imports", { success: "Import declined. No changes applied." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(buildUrl("/imports", { error: getErrorMessage(error) }));
    }
  }, "/imports");
}

export async function rollbackImportAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = rollbackImportSchema.parse({
      workspaceId: formData.get("workspaceId"),
      batchId: formData.get("batchId"),
    });

    try {
      const { user } = await requireAdminAccess(parsed.workspaceId);

      const batch = await db.importBatch.findUniqueOrThrow({
        where: { id: parsed.batchId },
      });

      if (batch.status !== ImportBatchStatus.APPLIED) {
        throw new Error(`Cannot rollback batch in status ${batch.status}. Must be APPLIED.`);
      }

      // Rollback using stored change-sets
      const { rollbackBatch } = await import("@/lib/imports/apply-engine");
      const rollbackResult = await rollbackBatch(db, parsed.batchId);

      await db.importBatch.update({
        where: { id: parsed.batchId },
        data: {
          status: ImportBatchStatus.ROLLED_BACK,
          rolledBackAt: new Date(),
          errorLog: rollbackResult.errors.length > 0
            ? `Rollback: ${rollbackResult.reverted} reverted, ${rollbackResult.errors.length} errors: ${rollbackResult.errors.join("; ")}`
            : null,
        },
      });

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "import.batch_rolled_back",
        entityType: "import_batch",
        entityId: parsed.batchId,
        metaJson: { importType: batch.importType },
      });

      revalidatePath("/imports");
      redirect(buildUrl("/imports", { success: "Import rolled back." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(buildUrl("/imports", { error: getErrorMessage(error) }));
    }
  }, "/imports");
}
