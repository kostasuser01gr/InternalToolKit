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
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { getRequestContext } from "@/lib/request-context";
import { AuthError } from "@/lib/rbac";
import {
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
}

export async function updatePreferencesAction(formData: FormData) {
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
