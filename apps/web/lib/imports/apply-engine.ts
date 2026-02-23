/**
 * Import apply engine — processes preview diffs and creates/updates records
 * while storing change-sets for rollback.
 */

import type { PrismaClient } from "@prisma/client";

import type { DiffSummary } from "./diff-engine";

export interface ApplyResult {
  applied: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

/**
 * Apply fleet (vehicle) import diffs.
 * Creates new vehicles or updates existing ones, storing change-sets.
 */
export async function applyFleetDiff(
  prisma: PrismaClient,
  batchId: string,
  workspaceId: string,
  diff: DiffSummary,
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, errors: [] };

  for (const record of diff.records) {
    if (record.action === "skip" || record.action === "error") {
      result.skipped++;
      continue;
    }

    try {
      if (record.action === "create") {
        const plateNumber = String(record.mappedData["plateNumber"] ?? "").trim().toUpperCase();
        if (!plateNumber) {
          result.errors.push({ rowIndex: record.rowIndex, message: "Missing plate number" });
          continue;
        }

        const created = await prisma.vehicle.create({
          data: {
            workspaceId,
            plateNumber,
            model: String(record.mappedData["model"] ?? "Unknown"),
            mileageKm: parseInt(String(record.mappedData["mileage"] ?? "0"), 10) || 0,
            notes: (record.mappedData["notes"] as string) ?? null,
          },
        });

        await prisma.importChangeSet.create({
          data: {
            batchId,
            entityType: "vehicle",
            entityId: created.id,
            action: "create",
            afterJson: JSON.parse(JSON.stringify(record.mappedData)),
          },
        });

        result.applied++;
      } else if (record.action === "update" && record.matchedId) {
        const before = await prisma.vehicle.findUnique({
          where: { id: record.matchedId },
        });

        if (!before) {
          result.errors.push({ rowIndex: record.rowIndex, message: `Vehicle ${record.matchedId} not found` });
          continue;
        }

        const updateData: Record<string, unknown> = {};
        if (record.changes) {
          for (const [field, change] of Object.entries(record.changes)) {
            if (field === "model") updateData.model = String(change.to);
            if (field === "mileage" || field === "mileageKm") updateData.mileageKm = parseInt(String(change.to), 10) || 0;
            if (field === "notes") updateData.notes = String(change.to);
            if (field === "fuelLevel" || field === "fuelPercent") updateData.fuelPercent = parseInt(String(change.to), 10) || 0;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.vehicle.update({
            where: { id: record.matchedId },
            data: updateData,
          });

          await prisma.importChangeSet.create({
            data: {
              batchId,
              entityType: "vehicle",
              entityId: record.matchedId,
              action: "update",
              beforeJson: JSON.parse(JSON.stringify({
                model: before.model,
                mileageKm: before.mileageKm,
                fuelPercent: before.fuelPercent,
                notes: before.notes,
              })),
              afterJson: JSON.parse(JSON.stringify(updateData)),
            },
          });

          result.applied++;
        } else {
          result.skipped++;
        }
      }
    } catch (err) {
      result.errors.push({
        rowIndex: record.rowIndex,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}

/**
 * Apply bookings import diffs — creates draft Shifts for staffing proposals.
 * Each booking with check-in data produces a DRAFT shift.
 */
export async function applyBookingsDiff(
  prisma: PrismaClient,
  batchId: string,
  workspaceId: string,
  diff: DiffSummary,
  createdBy: string,
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, errors: [] };

  for (const record of diff.records) {
    if (record.action === "skip" || record.action === "error") {
      result.skipped++;
      continue;
    }

    try {
      const d = record.mappedData;
      const checkInStr = String(d["checkInDate"] ?? "");
      const checkOutStr = String(d["checkOutDate"] ?? "");

      if (!checkInStr && !checkOutStr) {
        result.skipped++;
        continue;
      }

      const startsAt = checkOutStr ? new Date(checkOutStr) : new Date();
      const endsAt = checkInStr ? new Date(checkInStr) : new Date(startsAt.getTime() + 86400000);

      if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
        result.errors.push({ rowIndex: record.rowIndex, message: "Invalid date in booking" });
        continue;
      }

      const agreementNo = String(d["agreementNumber"] ?? d["confirmationNumber"] ?? "");
      const driverName = [d["driverFirstName"], d["driverLastName"]].filter(Boolean).join(" ");
      const title = `Booking ${agreementNo}${driverName ? ` — ${driverName}` : ""}`.trim();

      const shift = await prisma.shift.create({
        data: {
          workspaceId,
          createdBy,
          title,
          startsAt,
          endsAt,
          status: "DRAFT",
          notes: JSON.stringify({
            source: "bookings_import",
            batchId,
            agreementNumber: agreementNo,
            vehicleModel: d["vehicleModel"] ?? null,
            vehicleGroup: d["vehicleGroup"] ?? null,
            station: d["checkOutStation"] ?? d["checkInStation"] ?? null,
          }),
        },
      });

      await prisma.importChangeSet.create({
        data: {
          batchId,
          entityType: "shift",
          entityId: shift.id,
          action: "create",
          afterJson: JSON.parse(JSON.stringify(record.mappedData)),
        },
      });

      result.applied++;
    } catch (err) {
      result.errors.push({
        rowIndex: record.rowIndex,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}

export async function rollbackBatch(
  prisma: PrismaClient,
  batchId: string,
): Promise<{ reverted: number; errors: string[] }> {
  const changeSets = await prisma.importChangeSet.findMany({
    where: { batchId },
    orderBy: { createdAt: "desc" },
  });

  let reverted = 0;
  const errors: string[] = [];

  for (const cs of changeSets) {
    try {
      if (cs.action === "create" && cs.entityType === "vehicle") {
        await prisma.vehicle.update({
          where: { id: cs.entityId },
          data: { status: "OUT_OF_SERVICE", notes: `[Rolled back from import ${batchId}]` },
        });
        reverted++;
      } else if (cs.action === "create" && cs.entityType === "shift") {
        // Rollback booking-imported shifts: mark as cancelled
        await prisma.shift.update({
          where: { id: cs.entityId },
          data: { status: "CANCELLED", notes: `[Rolled back from import ${batchId}]` },
        });
        reverted++;
      } else if (cs.action === "update" && cs.entityType === "vehicle" && cs.beforeJson) {
        const before = cs.beforeJson as Record<string, unknown>;
        const updateData: Record<string, unknown> = {};
        if (before.model !== undefined) updateData.model = before.model;
        if (before.mileageKm !== undefined) updateData.mileageKm = before.mileageKm;
        if (before.fuelPercent !== undefined) updateData.fuelPercent = before.fuelPercent;
        if (before.notes !== undefined) updateData.notes = before.notes;

        if (Object.keys(updateData).length > 0) {
          await prisma.vehicle.update({
            where: { id: cs.entityId },
            data: updateData,
          });
          reverted++;
        }
      }
    } catch (err) {
      errors.push(`Failed to revert ${cs.entityType}:${cs.entityId}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return { reverted, errors };
}
