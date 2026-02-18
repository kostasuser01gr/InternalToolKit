"use server";

import { VehicleEventType, VehicleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import {
  createVehicleEventSchema,
  createVehicleSchema,
  updateVehicleSchema,
} from "@/lib/validators/fleet";

function buildFleetUrl(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `/fleet?${serialized}` : "/fleet";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid payload.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

export async function createVehicleAction(formData: FormData) {
  const parsed = createVehicleSchema.parse({
    workspaceId: formData.get("workspaceId"),
    plateNumber: formData.get("plateNumber"),
    model: formData.get("model"),
    status: formData.get("status") || VehicleStatus.READY,
    mileageKm: formData.get("mileageKm"),
    fuelPercent: formData.get("fuelPercent"),
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "fleet",
      "write",
    );

    const vehicle = await db.vehicle.create({
      data: {
        workspaceId: parsed.workspaceId,
        plateNumber: parsed.plateNumber,
        model: parsed.model,
        status: parsed.status,
        mileageKm: parsed.mileageKm,
        fuelPercent: parsed.fuelPercent,
        notes: parsed.notes ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "fleet.vehicle_created",
      entityType: "vehicle",
      entityId: vehicle.id,
      metaJson: {
        plateNumber: vehicle.plateNumber,
        status: vehicle.status,
      },
    });

    revalidatePath("/fleet");
    revalidatePath("/calendar");
    redirect(buildFleetUrl({ success: "Vehicle added." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildFleetUrl({ error: getErrorMessage(error) }));
  }
}

export async function updateVehicleAction(formData: FormData) {
  const parsed = updateVehicleSchema.parse({
    workspaceId: formData.get("workspaceId"),
    vehicleId: formData.get("vehicleId"),
    status: formData.get("status"),
    mileageKm: formData.get("mileageKm"),
    fuelPercent: formData.get("fuelPercent"),
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "fleet",
      "write",
    );

    const updated = await db.vehicle.update({
      where: { id: parsed.vehicleId },
      data: {
        status: parsed.status,
        mileageKm: parsed.mileageKm,
        fuelPercent: parsed.fuelPercent,
        notes: parsed.notes ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "fleet.vehicle_updated",
      entityType: "vehicle",
      entityId: updated.id,
      metaJson: {
        status: updated.status,
        mileageKm: updated.mileageKm,
        fuelPercent: updated.fuelPercent,
      },
    });

    revalidatePath("/fleet");
    revalidatePath("/calendar");
    redirect(buildFleetUrl({ success: "Vehicle updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildFleetUrl({ error: getErrorMessage(error) }));
  }
}

export async function addVehicleEventAction(formData: FormData) {
  const numericRaw = formData.get("valueNumber");

  const parsed = createVehicleEventSchema.parse({
    workspaceId: formData.get("workspaceId"),
    vehicleId: formData.get("vehicleId"),
    type: formData.get("type") || VehicleEventType.STATUS_CHANGE,
    valueText: formData.get("valueText") || undefined,
    valueNumber:
      typeof numericRaw === "string" && numericRaw.trim() !== ""
        ? numericRaw
        : undefined,
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "fleet",
      "write",
    );

    const event = await db.vehicleEvent.create({
      data: {
        workspaceId: parsed.workspaceId,
        vehicleId: parsed.vehicleId,
        actorUserId: user.id,
        type: parsed.type,
        valueText: parsed.valueText ?? null,
        valueNumber: parsed.valueNumber ?? null,
        notes: parsed.notes ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "fleet.vehicle_event_created",
      entityType: "vehicle_event",
      entityId: event.id,
      metaJson: {
        vehicleId: event.vehicleId,
        type: event.type,
      },
    });

    revalidatePath("/fleet");
    revalidatePath("/calendar");
    redirect(buildFleetUrl({ success: "Vehicle event added." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildFleetUrl({ error: getErrorMessage(error) }));
  }
}
