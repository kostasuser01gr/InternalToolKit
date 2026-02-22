"use server";

import { ShiftStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireWorkspacePermission } from "@/lib/rbac";

const MAX_BULK = 100;

/**
 * Bulk update shift status. Returns count of updated shifts + previous states
 * for undo support.
 */
export async function bulkUpdateShiftsAction(input: {
  workspaceId: string;
  shiftIds: string[];
  targetStatus: ShiftStatus;
}): Promise<{
  ok: boolean;
  count: number;
  previous: Array<{ id: string; status: ShiftStatus }>;
  error?: string;
}> {
  if (input.shiftIds.length === 0) {
    return { ok: false, count: 0, previous: [], error: "No shifts selected." };
  }
  if (input.shiftIds.length > MAX_BULK) {
    return { ok: false, count: 0, previous: [], error: `Max ${MAX_BULK} shifts at a time.` };
  }

  try {
    const { user } = await requireWorkspacePermission(
      input.workspaceId,
      "shifts",
      "write",
    );

    // Snapshot previous states for undo
    const shifts = await db.shift.findMany({
      where: { id: { in: input.shiftIds }, workspaceId: input.workspaceId },
      select: { id: true, status: true, title: true },
    });

    const previous = shifts.map((s) => ({ id: s.id, status: s.status }));

    await db.shift.updateMany({
      where: { id: { in: input.shiftIds }, workspaceId: input.workspaceId },
      data: {
        status: input.targetStatus,
        ...(input.targetStatus === ShiftStatus.PUBLISHED
          ? { publishedAt: new Date() }
          : {}),
        ...(input.targetStatus === ShiftStatus.LOCKED
          ? { lockedAt: new Date(), lockedBy: user.id }
          : {}),
      },
    });

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: `shifts.bulk_${input.targetStatus.toLowerCase()}`,
      entityType: "shift",
      entityId: input.shiftIds.join(","),
      metaJson: {
        count: shifts.length,
        targetStatus: input.targetStatus,
      },
    });

    revalidatePath("/shifts");
    return { ok: true, count: shifts.length, previous };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      previous: [],
      error: error instanceof Error ? error.message : "Unexpected error.",
    };
  }
}
