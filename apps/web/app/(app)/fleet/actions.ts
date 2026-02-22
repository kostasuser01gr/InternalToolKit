"use server";

import { VehicleEventType, VehicleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  isValidTransition,
  canSignoffQc,
  computeSlaDeadline,
} from "@/lib/fleet-pipeline";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import {
  createVehicleEventSchema,
  createVehicleSchema,
  qcSignoffSchema,
  transitionVehicleSchema,
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

export async function transitionVehicleAction(formData: FormData) {
  const parsed = transitionVehicleSchema.parse({
    workspaceId: formData.get("workspaceId"),
    vehicleId: formData.get("vehicleId"),
    targetStatus: formData.get("targetStatus"),
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "fleet",
      "write",
    );

    const vehicle = await db.vehicle.findUniqueOrThrow({
      where: { id: parsed.vehicleId },
      select: { status: true, plateNumber: true },
    });

    if (!isValidTransition(vehicle.status, parsed.targetStatus)) {
      throw new Error(
        `Invalid transition from ${vehicle.status} to ${parsed.targetStatus}.`,
      );
    }

    const slaDeadline = computeSlaDeadline(parsed.targetStatus);

    const updated = await db.vehicle.update({
      where: { id: parsed.vehicleId },
      data: {
        status: parsed.targetStatus,
        slaDeadlineAt: slaDeadline,
        ...(parsed.targetStatus !== ("QC_PENDING" as VehicleStatus)
          ? { qcResult: null, qcFailReason: null, qcSignoffBy: null }
          : {}),
      },
    });

    await db.vehicleEvent.create({
      data: {
        workspaceId: parsed.workspaceId,
        vehicleId: parsed.vehicleId,
        actorUserId: user.id,
        type: VehicleEventType.PIPELINE_TRANSITION,
        valueText: `${vehicle.status} → ${parsed.targetStatus}`,
        notes: parsed.notes ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "fleet.pipeline_transition",
      entityType: "vehicle",
      entityId: updated.id,
      metaJson: {
        from: vehicle.status,
        to: parsed.targetStatus,
        plateNumber: vehicle.plateNumber,
      },
    });

    revalidatePath("/fleet");
    revalidatePath("/calendar");
    redirect(
      buildFleetUrl({
        success: `${vehicle.plateNumber}: ${vehicle.status} → ${parsed.targetStatus}`,
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildFleetUrl({ error: getErrorMessage(error) }));
  }
}

export async function qcSignoffAction(formData: FormData) {
  const parsed = qcSignoffSchema.parse({
    workspaceId: formData.get("workspaceId"),
    vehicleId: formData.get("vehicleId"),
    result: formData.get("result"),
    failReason: formData.get("failReason") || undefined,
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user, membership } = await requireWorkspacePermission(
      parsed.workspaceId,
      "fleet",
      "write",
    );

    if (!canSignoffQc(membership.role)) {
      throw new AuthError("Only coordinators can perform QC signoff.");
    }

    const vehicle = await db.vehicle.findUniqueOrThrow({
      where: { id: parsed.vehicleId },
      select: { status: true, plateNumber: true },
    });

    if (vehicle.status !== ("QC_PENDING" as VehicleStatus)) {
      throw new Error("Vehicle must be in QC_PENDING status for signoff.");
    }

    const nextStatus: VehicleStatus =
      parsed.result === "PASS"
        ? ("READY" as VehicleStatus)
        : ("NEEDS_CLEANING" as VehicleStatus);

    const eventType: VehicleEventType =
      parsed.result === "PASS"
        ? VehicleEventType.QC_PASS
        : VehicleEventType.QC_FAIL;

    await db.vehicle.update({
      where: { id: parsed.vehicleId },
      data: {
        status: nextStatus,
        qcSignoffBy: user.id,
        qcResult: parsed.result,
        qcFailReason: parsed.result === "FAIL" ? (parsed.failReason ?? null) : null,
        slaDeadlineAt: parsed.result === "FAIL" ? computeSlaDeadline(nextStatus) : null,
      },
    });

    await db.vehicleEvent.create({
      data: {
        workspaceId: parsed.workspaceId,
        vehicleId: parsed.vehicleId,
        actorUserId: user.id,
        type: eventType,
        valueText: parsed.result === "FAIL" ? (parsed.failReason ?? null) : "PASS",
        notes: parsed.notes ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: `fleet.qc_${parsed.result.toLowerCase()}`,
      entityType: "vehicle",
      entityId: parsed.vehicleId,
      metaJson: {
        plateNumber: vehicle.plateNumber,
        result: parsed.result,
        failReason: parsed.failReason,
      },
    });

    revalidatePath("/fleet");
    redirect(
      buildFleetUrl({
        success: `QC ${parsed.result}: ${vehicle.plateNumber} → ${nextStatus}`,
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildFleetUrl({ error: getErrorMessage(error) }));
  }
}

const MAX_BULK_VEHICLES = 50;

export async function bulkUpdateVehiclesAction(input: {
  workspaceId: string;
  vehicleIds: string[];
  targetStatus: VehicleStatus;
}): Promise<{ ok: boolean; count: number; previous: Array<{ id: string; status: string }>; error?: string }> {
  try {
    if (input.vehicleIds.length === 0) return { ok: true, count: 0, previous: [] };
    if (input.vehicleIds.length > MAX_BULK_VEHICLES) {
      return { ok: false, count: 0, previous: [], error: `Max ${MAX_BULK_VEHICLES} vehicles per bulk operation.` };
    }

    const { user } = await requireWorkspacePermission(input.workspaceId, "fleet", "write");

    const vehicles = await db.vehicle.findMany({
      where: { id: { in: input.vehicleIds }, workspaceId: input.workspaceId },
      select: { id: true, status: true, plateNumber: true },
    });

    const valid = vehicles.filter((v) => isValidTransition(v.status, input.targetStatus));
    if (valid.length === 0) {
      return { ok: false, count: 0, previous: [], error: "No valid transitions found." };
    }

    const previous = valid.map((v) => ({ id: v.id, status: v.status }));
    const slaDeadline = computeSlaDeadline(input.targetStatus);

    for (const v of valid) {
      await db.vehicle.update({
        where: { id: v.id },
        data: {
          status: input.targetStatus,
          slaDeadlineAt: slaDeadline,
          ...(input.targetStatus !== ("QC_PENDING" as VehicleStatus)
            ? { qcResult: null, qcFailReason: null, qcSignoffBy: null }
            : {}),
        },
      });

      await db.vehicleEvent.create({
        data: {
          workspaceId: input.workspaceId,
          vehicleId: v.id,
          actorUserId: user.id,
          type: VehicleEventType.PIPELINE_TRANSITION,
          valueText: `${v.status} → ${input.targetStatus} (bulk)`,
        },
      });
    }

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: "fleet.bulk_transition",
      entityType: "vehicle",
      entityId: valid.map((v) => v.id).join(","),
      metaJson: { targetStatus: input.targetStatus, count: valid.length },
    });

    revalidatePath("/fleet");
    return { ok: true, count: valid.length, previous };
  } catch (error) {
    return { ok: false, count: 0, previous: [], error: error instanceof Error ? error.message : "Unexpected error." };
  }
}
