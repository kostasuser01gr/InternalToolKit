import { WorkspaceRole } from "@prisma/client";

import { db } from "@/lib/db";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/lib/convex-api";

export async function getDefaultWorkspaceForUser(userId: string) {
  const convex = getConvexClient();
  if (convex) {
    const result = await convex.query(api.workspaces.getDefaultMembership, { userId });
    if (!result) return null;
    return {
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

  return db.workspaceMember.findFirst({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: {
      workspace: {
        createdAt: "asc",
      },
    },
  });
}

export async function getWorkspaceForUser(
  userId: string,
  workspaceId?: string,
) {
  if (workspaceId) {
    const convex = getConvexClient();
    if (convex) {
      const result = await convex.query(api.workspaces.getMemberWithWorkspace, {
        workspaceId,
        userId,
      });
      if (!result) return null;
      return {
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

    return db.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
      include: {
        workspace: true,
      },
    });
  }

  return getDefaultWorkspaceForUser(userId);
}

export async function getWorkspaceRole(userId: string, workspaceId: string) {
  const convex = getConvexClient();
  if (convex) {
    const member = await convex.query(api.workspaces.getMember, {
      workspaceId,
      userId,
    });
    return (member?.role as WorkspaceRole) ?? null;
  }

  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  return membership?.role ?? null;
}

export function hasRole(role: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!role) {
    return false;
  }

  return allowed.includes(role);
}
