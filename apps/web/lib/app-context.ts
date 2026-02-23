import { redirect } from "next/navigation";
import type { WorkspaceRole } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { getWorkspaceForUser } from "@/lib/workspace";

export async function getAppContext(workspaceId?: string) {
  const session = await requireSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = session.user;

  let membership;
  try {
    membership = await getWorkspaceForUser(user.id, workspaceId);
  } catch (error) {
    if (isSchemaNotReadyError(error)) {
      redirect("/login?error=schema");
    }
    throw error;
  }

  if (!membership || !membership.workspace) {
    redirect("/login?error=no-workspace");
  }

  return {
    user,
    workspace: membership.workspace!,
    workspaceRole: membership.role as WorkspaceRole,
  };
}
