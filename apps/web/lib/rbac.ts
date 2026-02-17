import { WorkspaceRole } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDefaultWorkspaceForUser, hasRole } from "@/lib/workspace";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuthUser() {
  const session = await requireSession();

  if (!session?.user?.id) {
    throw new AuthError("Authentication required.");
  }

  return session.user;
}

export async function requireWorkspaceMembership(workspaceId?: string) {
  const user = await requireAuthUser();

  const membership = workspaceId
    ? await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id,
          },
        },
        include: {
          workspace: true,
        },
      })
    : await getDefaultWorkspaceForUser(user.id);

  if (!membership) {
    throw new AuthError("Workspace membership required.");
  }

  return {
    user,
    membership,
  };
}

export async function requireWorkspaceRole(
  workspaceId: string,
  allowedRoles: WorkspaceRole[],
) {
  const { user, membership } = await requireWorkspaceMembership(workspaceId);

  if (!hasRole(membership.role, allowedRoles)) {
    throw new AuthError("Insufficient role for this workspace action.");
  }

  return {
    user,
    membership,
  };
}

export async function requireAdminAccess(workspaceId?: string) {
  const { user, membership } = await requireWorkspaceMembership(workspaceId);

  const isGlobalAdmin = user.roleGlobal === "ADMIN";
  const isWorkspaceAdmin = membership.role === WorkspaceRole.ADMIN;

  if (!isGlobalAdmin && !isWorkspaceAdmin) {
    throw new AuthError("Admin access required.");
  }

  return {
    user,
    membership,
  };
}
