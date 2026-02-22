"use server";

import { AssetStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import {
  createAssetSchema,
  updateAssetSchema,
  recordHandoverSchema,
} from "@/lib/validators/inventory";

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

export async function createAssetAction(formData: FormData) {
  const parsed = createAssetSchema.parse({
    workspaceId: formData.get("workspaceId"),
    type: formData.get("type"),
    name: formData.get("name"),
    serialNumber: formData.get("serialNumber") || undefined,
    status: formData.get("status") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    reorderLevel: formData.get("reorderLevel") || undefined,
    quantity: formData.get("quantity") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "fleet", "write");

    const asset = await db.asset.create({
      data: {
        workspaceId: parsed.workspaceId,
        type: parsed.type,
        name: parsed.name,
        serialNumber: parsed.serialNumber ?? null,
        status: parsed.status ?? AssetStatus.AVAILABLE,
        location: parsed.location ?? null,
        notes: parsed.notes ?? null,
        reorderLevel: parsed.reorderLevel ?? null,
        quantity: parsed.quantity ?? 1,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "inventory.asset_created",
      entityType: "asset",
      entityId: asset.id,
      metaJson: { name: asset.name, type: asset.type },
    });

    revalidatePath("/inventory");
    redirect(buildUrl("/inventory", { success: "Asset created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/inventory", { error: getErrorMessage(error) }));
  }
}

export async function updateAssetAction(formData: FormData) {
  const parsed = updateAssetSchema.parse({
    workspaceId: formData.get("workspaceId"),
    assetId: formData.get("assetId"),
    status: formData.get("status") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    quantity: formData.get("quantity") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "fleet", "write");

    const updated = await db.asset.update({
      where: { id: parsed.assetId },
      data: {
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.location !== undefined ? { location: parsed.location ?? null } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes ?? null } : {}),
        ...(parsed.quantity !== undefined ? { quantity: parsed.quantity } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "inventory.asset_updated",
      entityType: "asset",
      entityId: updated.id,
      metaJson: { status: updated.status },
    });

    revalidatePath("/inventory");
    redirect(buildUrl("/inventory", { success: "Asset updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/inventory", { error: getErrorMessage(error) }));
  }
}

export async function recordHandoverAction(formData: FormData) {
  const parsed = recordHandoverSchema.parse({
    workspaceId: formData.get("workspaceId"),
    assetId: formData.get("assetId"),
    toUserId: formData.get("toUserId") || undefined,
    action: formData.get("action"),
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "fleet", "write");

    await db.assetHandover.create({
      data: {
        assetId: parsed.assetId,
        fromUserId: user.id,
        toUserId: parsed.toUserId ?? null,
        action: parsed.action,
        notes: parsed.notes ?? null,
      },
    });

    if (parsed.toUserId) {
      await db.asset.update({
        where: { id: parsed.assetId },
        data: { status: AssetStatus.IN_USE },
      });
    }

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "inventory.handover_recorded",
      entityType: "asset_handover",
      entityId: parsed.assetId,
      metaJson: { action: parsed.action, toUserId: parsed.toUserId },
    });

    revalidatePath("/inventory");
    redirect(buildUrl("/inventory", { success: "Handover recorded." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/inventory", { error: getErrorMessage(error) }));
  }
}
