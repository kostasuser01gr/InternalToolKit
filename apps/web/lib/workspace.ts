import { WorkspaceRole } from "@prisma/client";

import { db } from "@/lib/db";

export async function getDefaultWorkspaceForUser(userId: string) {
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
