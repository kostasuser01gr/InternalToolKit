"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createWorkspaceInvite } from "@/lib/auth/invite";
import { hasRecentAdminStepUp, verifyAdminStepUpPin } from "@/lib/auth/session";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { withDbAction } from "@/lib/prisma-errors";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { getRequestContext } from "@/lib/request-context";
import { AuthError, requireAdminAccess } from "@/lib/rbac";
import { logSecurityEvent } from "@/lib/security";
import {
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  verifyAdminStepUpSchema,
} from "@/lib/validators/admin";

function buildAdminUrl(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();

  return queryString ? `/admin?${queryString}` : "/admin";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

async function ensureAdminStepUp(workspaceId: string) {
  const stepUpActive = await hasRecentAdminStepUp();

  if (!stepUpActive) {
    throw new AuthError(
      "Step-up verification required. Re-enter your PIN to continue admin changes.",
    );
  }

  return requireAdminAccess(workspaceId);
}

export async function verifyAdminStepUpAction(formData: FormData) {
  const parsed = verifyAdminStepUpSchema.parse({
    workspaceId: formData.get("workspaceId"),
    pin: formData.get("pin"),
  });

  try {
    const { user, membership } = await requireAdminAccess(parsed.workspaceId);
    const context = await getRequestContext("/admin");

    const elevated = await verifyAdminStepUpPin(parsed.pin);
    if (!elevated) {
      logSecurityEvent("admin.step_up_failed", {
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        requestId: context.requestId,
      });
      throw new AuthError("Step-up verification failed. Check your PIN.");
    }

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "admin.step_up_verified",
      entityType: "session",
      entityId: user.id,
      metaJson: {
        adminRole: membership.role,
        requestId: context.requestId,
      },
    });

    revalidatePath("/admin");
    redirect(buildAdminUrl({ success: "Admin verification active for 10 minutes." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    const context = await getRequestContext("/admin");
    const errorId = crypto.randomUUID().slice(0, 12);
    redirect(
      buildAdminUrl({
        error: getErrorMessage(error),
        requestId: context.requestId,
        errorId,
      }),
    );
  }
}

export async function inviteMemberAction(formData: FormData) {
  const parsed = inviteMemberSchema.parse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  try {
    const { user, membership } = await ensureAdminStepUp(parsed.workspaceId);
    const context = await getRequestContext("/admin");

    const invite = await createWorkspaceInvite({
      workspaceId: parsed.workspaceId,
      invitedByUserId: user.id,
      email: parsed.email,
      role: parsed.role,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      deviceId: context.deviceId,
      route: context.route,
    });

    if (!invite.ok) {
      throw new Error(invite.message);
    }

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "admin.member_invited",
      entityType: "workspace_invite",
      entityId: invite.email,
      metaJson: {
        role: invite.role,
        adminRole: membership.role,
        expiresAt: invite.expiresAt.toISOString(),
        requestId: context.requestId,
      },
    });

    logSecurityEvent("admin.member_invited", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      invitedEmail: invite.email,
      role: invite.role,
      requestId: context.requestId,
    });

    revalidatePath("/admin");
    redirect(
      buildAdminUrl({
        success: "Invite generated. Share the one-time invite code now.",
        inviteCode: invite.token,
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    const context = await getRequestContext("/admin");
    const errorId = crypto.randomUUID().slice(0, 12);
    redirect(
      buildAdminUrl({
        error: getErrorMessage(error),
        requestId: context.requestId,
        errorId,
      }),
    );
  }
}

export async function updateMemberRoleAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = updateMemberRoleSchema.parse({
      workspaceId: formData.get("workspaceId"),
      userId: formData.get("userId"),
      role: formData.get("role"),
    });

    try {
      const { user } = await ensureAdminStepUp(parsed.workspaceId);

      await db.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: parsed.workspaceId,
            userId: parsed.userId,
          },
        },
        data: {
          role: parsed.role,
        },
      });

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "admin.member_role_updated",
        entityType: "workspace_member",
        entityId: parsed.userId,
        metaJson: {
          role: parsed.role,
        },
      });

      logSecurityEvent("admin.member_role_updated", {
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        memberUserId: parsed.userId,
        role: parsed.role,
      });

      revalidatePath("/admin");
      redirect(buildAdminUrl({ success: "Member role updated." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/admin");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildAdminUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/admin");
}

export async function removeMemberAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = removeMemberSchema.parse({
      workspaceId: formData.get("workspaceId"),
      userId: formData.get("userId"),
    });

    try {
      const { user } = await ensureAdminStepUp(parsed.workspaceId);

      const workspace = await db.workspace.findUnique({
        where: { id: parsed.workspaceId },
      });

      if (workspace?.ownerId === parsed.userId) {
        throw new Error("Cannot remove workspace owner.");
      }

      await db.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId: parsed.workspaceId,
            userId: parsed.userId,
          },
        },
      });

      await appendAuditLog({
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        action: "admin.member_removed",
        entityType: "workspace_member",
        entityId: parsed.userId,
        metaJson: {},
      });

      logSecurityEvent("admin.member_removed", {
        workspaceId: parsed.workspaceId,
        actorUserId: user.id,
        removedUserId: parsed.userId,
      });

      revalidatePath("/admin");
      redirect(buildAdminUrl({ success: "Member removed." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/admin");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildAdminUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/admin");
}
