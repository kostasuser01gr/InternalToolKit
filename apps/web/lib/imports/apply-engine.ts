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
 * Rollback a batch by reversing all change-sets.
 */
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
        // Soft-delete: archive the created vehicle
        await prisma.vehicle.update({
          where: { id: cs.entityId },
          data: { status: "OUT_OF_SERVICE", notes: `[Rolled back from import ${batchId}]` },
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
