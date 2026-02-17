"use server";

import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireAdminAccess } from "@/lib/rbac";
import { logSecurityEvent } from "@/lib/security";
import {
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
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

export async function inviteMemberAction(formData: FormData) {
  const parsed = inviteMemberSchema.parse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  try {
    const { user, membership } = await requireAdminAccess(parsed.workspaceId);

    const memberUser = await db.user.upsert({
      where: {
        email: parsed.email.toLowerCase(),
      },
      update: {},
      create: {
        email: parsed.email.toLowerCase(),
        name: parsed.email.split("@")[0] ?? "New Member",
        passwordHash: hashSync("ChangeMe123!", 12),
        roleGlobal: "USER",
      },
    });

    await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.workspaceId,
          userId: memberUser.id,
        },
      },
      update: {
        role: parsed.role,
      },
      create: {
        workspaceId: parsed.workspaceId,
        userId: memberUser.id,
        role: parsed.role,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "admin.member_invited",
      entityType: "workspace_member",
      entityId: memberUser.id,
      metaJson: {
        role: parsed.role,
        adminRole: membership.role,
      },
    });

    logSecurityEvent("admin.member_invited", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      invitedUserId: memberUser.id,
      role: parsed.role,
    });

    revalidatePath("/admin");
    redirect(buildAdminUrl({ success: "Member invited or updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildAdminUrl({ error: getErrorMessage(error) }));
  }
}

export async function updateMemberRoleAction(formData: FormData) {
  const parsed = updateMemberRoleSchema.parse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

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
    redirect(buildAdminUrl({ error: getErrorMessage(error) }));
  }
}

export async function removeMemberAction(formData: FormData) {
  const parsed = removeMemberSchema.parse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

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
    redirect(buildAdminUrl({ error: getErrorMessage(error) }));
  }
}
