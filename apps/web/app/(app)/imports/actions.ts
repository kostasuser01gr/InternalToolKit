"use server";

import { ImportBatchStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireAdminAccess } from "@/lib/rbac";
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

export async function createImportBatchAction(formData: FormData) {
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
}

export async function updateMappingAction(formData: FormData) {
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
}

export async function acceptImportAction(formData: FormData) {
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

    // TODO: Apply the diff (create/update records based on previewJson + mappingJson)
    // For now, mark as applied with a note that actual record creation
    // will be implemented when the specific domain handlers are wired up.

    await db.importBatch.update({
      where: { id: parsed.batchId },
      data: {
        status: ImportBatchStatus.APPLIED,
        appliedAt: new Date(),
      },
    });

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
}

export async function declineImportAction(formData: FormData) {
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
}

export async function rollbackImportAction(formData: FormData) {
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

    // TODO: Implement domain-specific rollback (mark created records, revert updates)

    await db.importBatch.update({
      where: { id: parsed.batchId },
      data: {
        status: ImportBatchStatus.ROLLED_BACK,
        rolledBackAt: new Date(),
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
}
