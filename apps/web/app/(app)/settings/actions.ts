"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError } from "@/lib/rbac";
import {
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

export async function updateProfileAction(formData: FormData) {
  const parsed = updateProfileSchema.parse({
    userId: formData.get("userId"),
    name: formData.get("name"),
  });

  try {
    const { user, workspace } = await getAppContext();

    if (user.id !== parsed.userId) {
      throw new AuthError("You can only update your own profile.");
    }

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
    redirect(buildSettingsUrl({ error: getErrorMessage(error) }));
  }
}

export async function updatePreferencesAction(formData: FormData) {
  const parsed = updatePreferencesSchema.parse({
    userId: formData.get("userId"),
    notificationsEnabled: formData.get("notificationsEnabled") === "on",
    themePreference: formData.get("themePreference"),
  });

  try {
    const { user, workspace } = await getAppContext();

    if (user.id !== parsed.userId) {
      throw new AuthError("You can only update your own preferences.");
    }

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
    redirect(buildSettingsUrl({ error: getErrorMessage(error) }));
  }
}
