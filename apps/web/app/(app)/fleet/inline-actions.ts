"use server";

import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireWorkspacePermission } from "@/lib/rbac";

const EDITABLE_FIELDS = new Set([
  "mileageKm",
  "fuelPercent",
  "notes",
  "status",
]);

/**
 * Inline update a single vehicle field. Returns the updated value
 * so the client can confirm the optimistic update.
 */
export async function inlineUpdateVehicleFieldAction(input: {
  workspaceId: string;
  vehicleId: string;
  field: string;
  value: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!EDITABLE_FIELDS.has(input.field)) {
    return { ok: false, error: `Field "${input.field}" is not editable.` };
  }

  try {
    const { user } = await requireWorkspacePermission(
      input.workspaceId,
      "fleet",
      "write",
    );

    const previous = await db.vehicle.findUniqueOrThrow({
      where: { id: input.vehicleId },
      select: {
        plateNumber: true,
        mileageKm: true,
        fuelPercent: true,
        notes: true,
        status: true,
      },
    });

    const previousValue = String(previous[input.field as keyof typeof previous] ?? "");

    let coerced: string | number | null = input.value;
    if (input.field === "mileageKm" || input.field === "fuelPercent") {
      const n = parseInt(input.value, 10);
      if (Number.isNaN(n) || n < 0) {
        return { ok: false, error: `Invalid number for ${input.field}.` };
      }
      if (input.field === "fuelPercent" && n > 100) {
        return { ok: false, error: "Fuel % must be 0–100." };
      }
      coerced = n;
    }
    if (input.field === "notes" && input.value === "") {
      coerced = null;
    }

    await db.vehicle.update({
      where: { id: input.vehicleId },
      data: { [input.field]: coerced },
    });

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: "fleet.vehicle_inline_edit",
      entityType: "vehicle",
      entityId: input.vehicleId,
      metaJson: {
        field: input.field,
        from: previousValue,
        to: String(coerced ?? ""),
        plateNumber: previous.plateNumber,
      },
    });

    revalidatePath("/fleet");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error.",
    };
  }
}
