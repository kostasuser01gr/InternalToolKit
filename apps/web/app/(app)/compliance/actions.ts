"use server";

import { AccessReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireAdminAccess } from "@/lib/rbac";
import {
  createRetentionPolicySchema,
  createAccessReviewSchema,
  resolveAccessReviewSchema,
} from "@/lib/validators/compliance";

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

export async function setRetentionPolicyAction(formData: FormData) {
  const parsed = createRetentionPolicySchema.parse({
    workspaceId: formData.get("workspaceId"),
    module: formData.get("module"),
    retainDays: formData.get("retainDays"),
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    await db.retentionPolicy.upsert({
      where: {
        workspaceId_module: {
          workspaceId: parsed.workspaceId,
          module: parsed.module,
        },
      },
      create: {
        workspaceId: parsed.workspaceId,
        module: parsed.module,
        retainDays: parsed.retainDays,
        createdBy: user.id,
      },
      update: {
        retainDays: parsed.retainDays,
        createdBy: user.id,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "compliance.retention_set",
      entityType: "retention_policy",
      entityId: parsed.module,
      metaJson: { module: parsed.module, retainDays: parsed.retainDays },
    });

    revalidatePath("/compliance");
    redirect(buildUrl("/compliance", { success: `Retention set: ${parsed.module} = ${parsed.retainDays}d.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/compliance", { error: getErrorMessage(error) }));
  }
}

export async function createAccessReviewAction(formData: FormData) {
  const parsed = createAccessReviewSchema.parse({
    workspaceId: formData.get("workspaceId"),
    targetUserId: formData.get("targetUserId"),
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    const review = await db.accessReview.create({
      data: {
        workspaceId: parsed.workspaceId,
        reviewerId: user.id,
        targetUserId: parsed.targetUserId,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "compliance.access_review_created",
      entityType: "access_review",
      entityId: review.id,
      metaJson: { targetUserId: parsed.targetUserId },
    });

    revalidatePath("/compliance");
    redirect(buildUrl("/compliance", { success: "Access review created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/compliance", { error: getErrorMessage(error) }));
  }
}

export async function resolveAccessReviewAction(formData: FormData) {
  const parsed = resolveAccessReviewSchema.parse({
    workspaceId: formData.get("workspaceId"),
    reviewId: formData.get("reviewId"),
    status: formData.get("status"),
    decision: formData.get("decision") || undefined,
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    const updated = await db.accessReview.update({
      where: { id: parsed.reviewId },
      data: {
        status: parsed.status as AccessReviewStatus,
        decision: parsed.decision ?? null,
        reviewedAt: new Date(),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "compliance.access_review_resolved",
      entityType: "access_review",
      entityId: updated.id,
      metaJson: { status: parsed.status, decision: parsed.decision },
    });

    revalidatePath("/compliance");
    redirect(buildUrl("/compliance", { success: `Access review ${parsed.status.toLowerCase()}.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/compliance", { error: getErrorMessage(error) }));
  }
}
