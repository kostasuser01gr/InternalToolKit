"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission, requireWorkspaceRole } from "@/lib/rbac";
import {
  createSavedViewSchema,
  createRunbookSchema,
  updateRunbookSchema,
} from "@/lib/validators/search";
import { WorkspaceRole } from "@prisma/client";

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

export async function createSavedViewAction(formData: FormData) {
  const parsed = createSavedViewSchema.parse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    module: formData.get("module"),
    filtersJson: formData.get("filtersJson"),
    columnsJson: formData.get("columnsJson") || undefined,
    sortJson: formData.get("sortJson") || undefined,
    isDefault: formData.get("isDefault") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER, WorkspaceRole.VIEWER,
    ]);

    const view = await db.savedView.create({
      data: {
        workspaceId: parsed.workspaceId,
        userId: user.id,
        name: parsed.name,
        module: parsed.module,
        filtersJson: JSON.parse(parsed.filtersJson),
        columnsJson: parsed.columnsJson ? JSON.parse(parsed.columnsJson) : null,
        sortJson: parsed.sortJson ? JSON.parse(parsed.sortJson) : null,
        isDefault: parsed.isDefault ?? false,
      },
    });

    revalidatePath(`/${parsed.module}`);
    redirect(buildUrl(`/${parsed.module}`, { success: `View "${view.name}" saved.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/overview", { error: getErrorMessage(error) }));
  }
}

export async function createRunbookAction(formData: FormData) {
  const parsed = createRunbookSchema.parse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    content: formData.get("content"),
    tags: formData.get("tags") || undefined,
    pinned: formData.get("pinned") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "data", "write");

    const runbook = await db.runbook.create({
      data: {
        workspaceId: parsed.workspaceId,
        createdBy: user.id,
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags ?? null,
        pinned: parsed.pinned ?? false,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "runbook.created",
      entityType: "runbook",
      entityId: runbook.id,
      metaJson: { title: runbook.title },
    });

    revalidatePath("/search");
    redirect(buildUrl("/search", { success: "Runbook created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/search", { error: getErrorMessage(error) }));
  }
}

export async function updateRunbookAction(formData: FormData) {
  const parsed = updateRunbookSchema.parse({
    workspaceId: formData.get("workspaceId"),
    runbookId: formData.get("runbookId"),
    title: formData.get("title") || undefined,
    content: formData.get("content") || undefined,
    tags: formData.get("tags") || undefined,
    pinned: formData.get("pinned") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "data", "write");

    const updated = await db.runbook.update({
      where: { id: parsed.runbookId },
      data: {
        ...(parsed.title ? { title: parsed.title } : {}),
        ...(parsed.content ? { content: parsed.content } : {}),
        ...(parsed.tags !== undefined ? { tags: parsed.tags ?? null } : {}),
        ...(parsed.pinned !== undefined ? { pinned: parsed.pinned } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "runbook.updated",
      entityType: "runbook",
      entityId: updated.id,
      metaJson: { title: updated.title },
    });

    revalidatePath("/search");
    redirect(buildUrl("/search", { success: "Runbook updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/search", { error: getErrorMessage(error) }));
  }
}
