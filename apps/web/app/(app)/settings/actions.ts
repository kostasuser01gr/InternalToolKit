"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import {
  getCurrentSessionId,
  revokeAllSessionsForUser,
  revokeSessionForUser,
} from "@/lib/auth/session";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { withDbAction } from "@/lib/prisma-errors";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { getRequestContext } from "@/lib/request-context";
import { AuthError } from "@/lib/rbac";
import {
  createActionButtonSchema,
  createPromptTemplateSchema,
  createShortcutSchema,
  deleteActionButtonSchema,
  deletePromptTemplateSchema,
  deleteShortcutSchema,
  revokeAllSessionsSchema,
  revokeSessionSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "@/lib/validators/settings";

function buildSettingsUrl(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();

  return queryString ? `/settings?${queryString}` : "/settings";
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

async function assertCurrentUser(userId: string) {
  const { user, workspace } = await getAppContext();

  if (user.id !== userId) {
    throw new AuthError("You can only manage your own account settings.");
  }

  return { user, workspace };
}

export async function updateProfileAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = updateProfileSchema.parse({
      userId: formData.get("userId"),
      name: formData.get("name"),
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.user.update({
        where: { id: parsed.userId },
        data: {
          name: parsed.name,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.profile_updated",
        entityType: "user",
        entityId: user.id,
        metaJson: { name: parsed.name },
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Profile updated." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function updatePreferencesAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = updatePreferencesSchema.parse({
      userId: formData.get("userId"),
      notificationsEnabled: formData.get("notificationsEnabled") === "on",
      themePreference: formData.get("themePreference"),
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.user.update({
        where: { id: parsed.userId },
        data: {
          notificationsEnabled: parsed.notificationsEnabled,
          themePreference: parsed.themePreference,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.preferences_updated",
        entityType: "user",
        entityId: user.id,
        metaJson: {
          notificationsEnabled: parsed.notificationsEnabled,
          themePreference: parsed.themePreference,
        },
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Preferences updated." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function revokeSessionAction(formData: FormData) {
  const parsed = revokeSessionSchema.parse({
    userId: formData.get("userId"),
    sessionId: formData.get("sessionId"),
  });

  try {
    const { user, workspace } = await assertCurrentUser(parsed.userId);

    await revokeSessionForUser(user.id, parsed.sessionId);

    await appendAuditLog({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "settings.session_revoked",
      entityType: "session",
      entityId: parsed.sessionId,
      metaJson: {},
    });

    revalidatePath("/settings");
    redirect(buildSettingsUrl({ success: "Session revoked." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    const context = await getRequestContext("/settings");
    const errorId = crypto.randomUUID().slice(0, 12);
    redirect(
      buildSettingsUrl({
        error: getErrorMessage(error),
        requestId: context.requestId,
        errorId,
      }),
    );
  }
}

export async function revokeCurrentSessionAction(formData: FormData) {
  const parsed = revokeAllSessionsSchema.parse({
    userId: formData.get("userId"),
  });

  try {
    const { user, workspace } = await assertCurrentUser(parsed.userId);
    const currentSessionId = await getCurrentSessionId();

    if (!currentSessionId) {
      throw new AuthError("Current session was not found.");
    }

    await revokeSessionForUser(user.id, currentSessionId);

    await appendAuditLog({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "settings.session_revoked_current",
      entityType: "session",
      entityId: currentSessionId,
      metaJson: {},
    });

    redirect("/login?success=Current session revoked");
  } catch (error) {
    rethrowIfRedirectError(error);
    const context = await getRequestContext("/settings");
    const errorId = crypto.randomUUID().slice(0, 12);
    redirect(
      buildSettingsUrl({
        error: getErrorMessage(error),
        requestId: context.requestId,
        errorId,
      }),
    );
  }
}

export async function revokeAllSessionsAction(formData: FormData) {
  const parsed = revokeAllSessionsSchema.parse({
    userId: formData.get("userId"),
  });

  try {
    const { user, workspace } = await assertCurrentUser(parsed.userId);
    const currentSessionId = await getCurrentSessionId();

    await revokeAllSessionsForUser(user.id, currentSessionId ?? undefined);

    await appendAuditLog({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: "settings.sessions_revoked_all",
      entityType: "session",
      entityId: user.id,
      metaJson: {
        exceptSessionId: currentSessionId,
      },
    });

    revalidatePath("/settings");
    redirect(buildSettingsUrl({ success: "All other sessions revoked." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    const context = await getRequestContext("/settings");
    const errorId = crypto.randomUUID().slice(0, 12);
    redirect(
      buildSettingsUrl({
        error: getErrorMessage(error),
        requestId: context.requestId,
        errorId,
      }),
    );
  }
}

export async function createShortcutAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = createShortcutSchema.parse({
      userId: formData.get("userId"),
      workspaceId: formData.get("workspaceId"),
      label: formData.get("label"),
      command: formData.get("command"),
      keybinding: formData.get("keybinding") || undefined,
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.userShortcut.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          label: parsed.label,
          command: parsed.command,
          keybinding: parsed.keybinding ?? null,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.shortcut_created",
        entityType: "user_shortcut",
        entityId: user.id,
        metaJson: {
          label: parsed.label,
        },
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Shortcut saved." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function deleteShortcutAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = deleteShortcutSchema.parse({
      userId: formData.get("userId"),
      workspaceId: formData.get("workspaceId"),
      shortcutId: formData.get("shortcutId"),
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.userShortcut.deleteMany({
        where: {
          id: parsed.shortcutId,
          workspaceId: workspace.id,
          userId: user.id,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.shortcut_deleted",
        entityType: "user_shortcut",
        entityId: parsed.shortcutId,
        metaJson: {},
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Shortcut removed." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function createActionButtonAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = createActionButtonSchema.parse({
      userId: formData.get("userId"),
      workspaceId: formData.get("workspaceId"),
      label: formData.get("label"),
      action: formData.get("action"),
      position: formData.get("position") || undefined,
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.userActionButton.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          label: parsed.label,
          action: parsed.action,
          position: parsed.position ?? 0,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.action_button_created",
        entityType: "user_action_button",
        entityId: user.id,
        metaJson: {
          label: parsed.label,
        },
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Quick action button saved." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function deleteActionButtonAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = deleteActionButtonSchema.parse({
      userId: formData.get("userId"),
      workspaceId: formData.get("workspaceId"),
      buttonId: formData.get("buttonId"),
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.userActionButton.deleteMany({
        where: {
          id: parsed.buttonId,
          workspaceId: workspace.id,
          userId: user.id,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.action_button_deleted",
        entityType: "user_action_button",
        entityId: parsed.buttonId,
        metaJson: {},
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Quick action button removed." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function createPromptTemplateAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = createPromptTemplateSchema.parse({
      userId: formData.get("userId"),
      workspaceId: formData.get("workspaceId"),
      title: formData.get("title"),
      prompt: formData.get("prompt"),
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.promptTemplate.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          title: parsed.title,
          prompt: parsed.prompt,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.prompt_template_created",
        entityType: "prompt_template",
        entityId: user.id,
        metaJson: {
          title: parsed.title,
        },
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Prompt template saved." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}

export async function deletePromptTemplateAction(formData: FormData) {
  return withDbAction(async () => {
    const parsed = deletePromptTemplateSchema.parse({
      userId: formData.get("userId"),
      workspaceId: formData.get("workspaceId"),
      templateId: formData.get("templateId"),
    });

    try {
      const { user, workspace } = await assertCurrentUser(parsed.userId);

      await db.promptTemplate.deleteMany({
        where: {
          id: parsed.templateId,
          workspaceId: workspace.id,
          userId: user.id,
        },
      });

      await appendAuditLog({
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "settings.prompt_template_deleted",
        entityType: "prompt_template",
        entityId: parsed.templateId,
        metaJson: {},
      });

      revalidatePath("/settings");
      redirect(buildSettingsUrl({ success: "Prompt template removed." }));
    } catch (error) {
      rethrowIfRedirectError(error);
      const context = await getRequestContext("/settings");
      const errorId = crypto.randomUUID().slice(0, 12);
      redirect(
        buildSettingsUrl({
          error: getErrorMessage(error),
          requestId: context.requestId,
          errorId,
        }),
      );
    }
  }, "/settings");
}
