"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireAdminAccess } from "@/lib/rbac";
import {
  createStationSchema,
  updateStationSchema,
} from "@/lib/validators/station";

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const s = query.toString();
  return s ? `${base}?${s}` : base;
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}

export async function createStationAction(formData: FormData) {
  const parsed = createStationSchema.parse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    code: formData.get("code"),
    address: formData.get("address") || undefined,
    configJson: formData.get("configJson") || undefined,
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    const station = await db.station.create({
      data: {
        workspaceId: parsed.workspaceId,
        name: parsed.name,
        code: parsed.code,
        address: parsed.address ?? null,
        configJson: parsed.configJson ? JSON.parse(parsed.configJson) : null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "station.created",
      entityType: "station",
      entityId: station.id,
      metaJson: { name: station.name, code: station.code },
    });

    revalidatePath("/stations");
    redirect(buildUrl("/stations", { success: "Station created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/stations", { error: getErrorMessage(error) }));
  }
}

export async function updateStationAction(formData: FormData) {
  const parsed = updateStationSchema.parse({
    workspaceId: formData.get("workspaceId"),
    stationId: formData.get("stationId"),
    name: formData.get("name") || undefined,
    address: formData.get("address") || undefined,
    isActive: formData.get("isActive") ?? undefined,
    configJson: formData.get("configJson") || undefined,
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    const updated = await db.station.update({
      where: { id: parsed.stationId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.address !== undefined ? { address: parsed.address ?? null } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.configJson ? { configJson: JSON.parse(parsed.configJson) } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "station.updated",
      entityType: "station",
      entityId: updated.id,
      metaJson: { name: updated.name, isActive: updated.isActive },
    });

    revalidatePath("/stations");
    redirect(buildUrl("/stations", { success: "Station updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/stations", { error: getErrorMessage(error) }));
  }
}
