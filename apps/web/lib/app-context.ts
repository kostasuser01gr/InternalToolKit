import { AuthError, requireAuthUser } from "@/lib/rbac";
import { getWorkspaceForUser } from "@/lib/workspace";

export async function getAppContext(workspaceId?: string) {
  const user = await requireAuthUser();
  const membership = await getWorkspaceForUser(user.id, workspaceId);

  if (!membership) {
    throw new AuthError("No workspace access found.");
  }

  return {
    user,
    workspace: membership.workspace,
    workspaceRole: membership.role,
  };
}
