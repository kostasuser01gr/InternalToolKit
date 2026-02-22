"use server";

import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireWorkspacePermission } from "@/lib/rbac";

export async function updateStationCoordsAction(input: {
  workspaceId: string;
  stationId: string;
  lat: number;
  lon: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (Number.isNaN(input.lat) || Number.isNaN(input.lon)) {
    return { ok: false, error: "Invalid coordinates." };
  }
  if (input.lat < -90 || input.lat > 90) {
    return { ok: false, error: "Latitude must be between -90 and 90." };
  }
  if (input.lon < -180 || input.lon > 180) {
    return { ok: false, error: "Longitude must be between -180 and 180." };
  }

  try {
    const { user } = await requireWorkspacePermission(
      input.workspaceId,
      "admin",
      "manage_members",
    );

    const station = await db.station.findUniqueOrThrow({
      where: { id: input.stationId },
      select: { name: true, configJson: true },
    });

    const existingConfig =
      station.configJson && typeof station.configJson === "object"
        ? (station.configJson as Record<string, unknown>)
        : {};

    await db.station.update({
      where: { id: input.stationId },
      data: {
        configJson: {
          ...existingConfig,
          lat: input.lat,
          lon: input.lon,
        },
      },
    });

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: "station.coords_updated",
      entityType: "station",
      entityId: input.stationId,
      metaJson: {
        stationName: station.name,
        lat: input.lat,
        lon: input.lon,
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
