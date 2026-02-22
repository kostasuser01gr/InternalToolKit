"use server";

import { IncidentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import {
  createIncidentSchema,
  updateIncidentSchema,
} from "@/lib/validators/incidents";

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

export async function createIncidentAction(formData: FormData) {
  const parsed = createIncidentSchema.parse({
    workspaceId: formData.get("workspaceId"),
    vehicleId: formData.get("vehicleId") || undefined,
    severity: formData.get("severity"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    photosJson: formData.get("photosJson") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "fleet", "write");

    const photos = parsed.photosJson ? JSON.parse(parsed.photosJson) : null;

    const incident = await db.incident.create({
      data: {
        workspaceId: parsed.workspaceId,
        vehicleId: parsed.vehicleId ?? null,
        reportedBy: user.id,
        severity: parsed.severity,
        title: parsed.title,
        description: parsed.description ?? null,
        photosJson: photos,
      },
    });

    // If linked to a vehicle, also create a VehicleEvent
    if (parsed.vehicleId) {
      await db.vehicleEvent.create({
        data: {
          workspaceId: parsed.workspaceId,
          vehicleId: parsed.vehicleId,
          actorUserId: user.id,
          type: "DAMAGE_REPORT",
          valueText: parsed.title,
          notes: parsed.description ?? null,
        },
      });
    }

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "incident.created",
      entityType: "incident",
      entityId: incident.id,
      metaJson: { severity: parsed.severity, title: parsed.title, vehicleId: parsed.vehicleId },
    });

    revalidatePath("/incidents");
    revalidatePath("/fleet");
    redirect(buildUrl("/incidents", { success: "Incident reported." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/incidents", { error: getErrorMessage(error) }));
  }
}

export async function updateIncidentAction(formData: FormData) {
  const parsed = updateIncidentSchema.parse({
    workspaceId: formData.get("workspaceId"),
    incidentId: formData.get("incidentId"),
    status: formData.get("status") || undefined,
    severity: formData.get("severity") || undefined,
    repairEta: formData.get("repairEta") || undefined,
    repairCost: formData.get("repairCost") || undefined,
    claimRef: formData.get("claimRef") || undefined,
    description: formData.get("description") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "fleet", "write");

    const updated = await db.incident.update({
      where: { id: parsed.incidentId },
      data: {
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.severity ? { severity: parsed.severity } : {}),
        ...(parsed.repairEta ? { repairEta: new Date(parsed.repairEta) } : {}),
        ...(parsed.repairCost !== undefined ? { repairCost: parsed.repairCost } : {}),
        ...(parsed.claimRef !== undefined ? { claimRef: parsed.claimRef ?? null } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.status === IncidentStatus.RESOLVED || parsed.status === IncidentStatus.CLOSED
          ? { resolvedAt: new Date() }
          : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "incident.updated",
      entityType: "incident",
      entityId: updated.id,
      metaJson: { status: updated.status, severity: updated.severity },
    });

    revalidatePath("/incidents");
    revalidatePath("/fleet");
    redirect(buildUrl("/incidents", { success: "Incident updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/incidents", { error: getErrorMessage(error) }));
  }
}
