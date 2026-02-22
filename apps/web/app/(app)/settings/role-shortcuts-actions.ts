"use server";

import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireWorkspacePermission } from "@/lib/rbac";

type RoleShortcut = {
  id: string;
  label: string;
  command: string;
};

type RoleShortcutsConfig = Record<string, RoleShortcut[]>;

const RESERVED_TITLE = "__workspace_role_shortcuts__";

/**
 * Save role-recommended shortcuts for the workspace.
 * Stored as a PromptTemplate with a reserved title (no schema change needed).
 * Coordinator/Admin only.
 */
export async function saveRoleShortcutsAction(input: {
  workspaceId: string;
  roleShortcuts: RoleShortcutsConfig;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { user } = await requireWorkspacePermission(
      input.workspaceId,
      "admin",
      "manage_members",
    );

    const existing = await db.promptTemplate.findFirst({
      where: { workspaceId: input.workspaceId, title: RESERVED_TITLE },
    });

    const prompt = JSON.stringify(input.roleShortcuts);

    if (existing) {
      await db.promptTemplate.update({
        where: { id: existing.id },
        data: { prompt },
      });
    } else {
      await db.promptTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          userId: user.id,
          title: RESERVED_TITLE,
          prompt,
        },
      });
    }

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: "admin.update_role_shortcuts",
      entityType: "workspace",
      entityId: input.workspaceId,
      metaJson: {
        roles: Object.keys(input.roleShortcuts),
        totalShortcuts: Object.values(input.roleShortcuts).reduce((s, a) => s + a.length, 0),
      },
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error.",
    };
  }
}

/**
 * Get role-recommended shortcuts for the workspace.
 */
export async function getRoleShortcuts(
  workspaceId: string,
): Promise<RoleShortcutsConfig> {
  try {
    const entry = await db.promptTemplate.findFirst({
      where: { workspaceId, title: RESERVED_TITLE },
    });
    if (!entry) return {};
    return JSON.parse(entry.prompt) as RoleShortcutsConfig;
  } catch {
    return {};
  }
}
