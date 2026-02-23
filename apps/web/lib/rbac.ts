import { WorkspaceRole } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/lib/convex-api";
import { getDefaultWorkspaceForUser, hasRole } from "@/lib/workspace";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

type ResourceActionMap = {
  admin: "manage_members" | "read_audit";
  chat: "read" | "write";
  data: "read" | "write";
  shifts: "read" | "write" | "approve_requests";
  fleet: "read" | "write";
  washers: "read" | "write";
  calendar: "read" | "write";
  notifications: "read";
  analytics: "read" | "export";
};

export type WorkspaceResource = keyof ResourceActionMap;
export type WorkspaceAction<R extends WorkspaceResource> = ResourceActionMap[R];
export type WorkspacePermission = {
  [R in WorkspaceResource]: Record<ResourceActionMap[R], WorkspaceRole[]>;
};
type WorkspaceAnyAction = ResourceActionMap[WorkspaceResource];
type WorkspacePermissionByRole = Record<
  WorkspaceRole,
  Partial<Record<WorkspaceResource, WorkspaceAnyAction[]>>
>;

export const workspacePermissionMatrix: WorkspacePermission = {
  admin: {
    manage_members: [WorkspaceRole.ADMIN],
    read_audit: [WorkspaceRole.ADMIN],
  },
  chat: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
    write: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
    ],
  },
  data: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
    write: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE],
  },
  shifts: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
    write: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE],
    approve_requests: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
  },
  fleet: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
    write: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE],
  },
  washers: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
    write: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.WASHER],
  },
  calendar: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
    write: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE],
  },
  notifications: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ],
  },
  analytics: {
    read: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.VIEWER,
    ],
    export: [WorkspaceRole.ADMIN, WorkspaceRole.EDITOR],
  },
};

const workspacePermissionMatrixByRole: WorkspacePermissionByRole = {
  [WorkspaceRole.ADMIN]: {},
  [WorkspaceRole.EDITOR]: {},
  [WorkspaceRole.EMPLOYEE]: {},
  [WorkspaceRole.WASHER]: {},
  [WorkspaceRole.VIEWER]: {},
};

for (const [resource, permissionByAction] of Object.entries(
  workspacePermissionMatrix,
) as [WorkspaceResource, WorkspacePermission[WorkspaceResource]][]) {
  for (const [action, roles] of Object.entries(permissionByAction) as [
    WorkspaceAnyAction,
    WorkspaceRole[],
  ][]) {
    for (const role of roles) {
      const existing = workspacePermissionMatrixByRole[role][resource] ?? [];
      if (!existing.includes(action)) {
        workspacePermissionMatrixByRole[role][resource] = [...existing, action];
      }
    }
  }
}

export function hasWorkspacePermission<R extends WorkspaceResource>(
  role: WorkspaceRole | null,
  resource: R,
  action: WorkspaceAction<R>,
) {
  if (!role) {
    return false;
  }

  const allowedActions = workspacePermissionMatrixByRole[role][resource];
  if (!allowedActions) {
    return false;
  }

  return allowedActions.includes(action);
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

  let membership: any = null;

  if (workspaceId) {
    const convex = getConvexClient();
    if (convex) {
      const result = await convex.query(api.workspaces.getMemberWithWorkspace, {
        workspaceId,
        userId: user.id,
      });
      if (result) {
        membership = {
          ...result,
          id: result._id,
          createdAt: new Date(result._creationTime),
          workspace: result.workspace
            ? {
                ...result.workspace,
                id: result.workspace._id,
                createdAt: new Date(result.workspace._creationTime),
              }
            : null,
        };
      }
    } else {
      membership = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id,
          },
        },
        include: {
          workspace: true,
        },
      });
    }
  } else {
    membership = await getDefaultWorkspaceForUser(user.id);
  }

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

export async function requireWorkspacePermission<R extends WorkspaceResource>(
  workspaceId: string,
  resource: R,
  action: WorkspaceAction<R>,
) {
  const { user, membership } = await requireWorkspaceMembership(workspaceId);

  if (!hasWorkspacePermission(membership.role, resource, action)) {
    throw new AuthError(
      `Insufficient role for ${resource}.${action} in this workspace.`,
    );
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
