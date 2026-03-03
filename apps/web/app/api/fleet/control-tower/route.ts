import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";

const querySchema = z.object({
  workspaceId: z.string().min(1),
  slaMinutes: z.coerce.number().int().min(5).max(24 * 60).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    slaMinutes: searchParams.get("slaMinutes") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid query.",
      status: 400,
    });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "fleet", "read");

    const now = new Date();
    const slaMinutes = parsed.data.slaMinutes ?? 30;
    const stuckBefore = new Date(Date.now() - slaMinutes * 60_000);

    const [
      vehiclesByState,
      slaBreaches,
      blockers,
      qcBacklog,
      washersQueue,
      stationThroughput,
      activeShiftAssignees,
      washerLoad,
    ] = await Promise.all([
      db.vehicle.groupBy({
        by: ["pipelineState"],
        where: { workspaceId: parsed.data.workspaceId },
        _count: { _all: true },
      }),
      db.vehicle.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          OR: [
            {
              slaDeadlineAt: { lt: now },
              pipelineState: { in: ["NEEDS_CLEANING", "CLEANING", "QC_PENDING", "BLOCKED"] },
            },
            {
              pipelineState: { in: ["NEEDS_CLEANING", "CLEANING", "QC_PENDING"] },
              updatedAt: { lt: stuckBefore },
            },
          ],
        },
        select: {
          id: true,
          plateNumber: true,
          pipelineState: true,
          slaDeadlineAt: true,
          updatedAt: true,
          needByAt: true,
        },
        take: 200,
      }),
      db.vehicleBlocker.groupBy({
        by: ["type"],
        where: {
          workspaceId: parsed.data.workspaceId,
          resolvedAt: null,
        },
        _count: { _all: true },
      }),
      db.vehicleQcLog.groupBy({
        by: ["status"],
        where: {
          workspaceId: parsed.data.workspaceId,
          status: { in: ["PENDING", "FAILED", "REWORK"] },
        },
        _count: { _all: true },
      }),
      db.washerTask.groupBy({
        by: ["status"],
        where: {
          workspaceId: parsed.data.workspaceId,
          status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
        },
        _count: { _all: true },
      }),
      db.washerTask.groupBy({
        by: ["stationId"],
        where: {
          workspaceId: parsed.data.workspaceId,
          status: "DONE",
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
      }),
      db.shift.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          startsAt: { lte: now },
          endsAt: { gte: now },
          status: { in: ["PUBLISHED", "REVIEW", "DRAFT"] },
          assignedUserId: { not: null },
        },
        select: {
          assignedUserId: true,
          assignee: { select: { id: true, name: true } },
        },
      }),
      db.washerTask.groupBy({
        by: ["washerUserId"],
        where: {
          workspaceId: parsed.data.workspaceId,
          status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
          washerUserId: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

    const washerMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        role: { in: [WorkspaceRole.WASHER, WorkspaceRole.EMPLOYEE] },
      },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const activeAssigneeIds = new Set(
      activeShiftAssignees.map((shift) => shift.assignedUserId).filter((value): value is string => Boolean(value)),
    );

    const loadByWasher = new Map(
      washerLoad
        .filter((item) => item.washerUserId)
        .map((item) => [item.washerUserId as string, item._count._all]),
    );

    const assignmentSuggestions = washerMembers
      .filter((member) => activeAssigneeIds.has(member.userId))
      .map((member) => ({
        userId: member.userId,
        name: member.user.name,
        role: member.role,
        activeQueueItems: loadByWasher.get(member.userId) ?? 0,
      }))
      .sort((a, b) => a.activeQueueItems - b.activeQueueItems)
      .slice(0, 10);

    return apiSuccess(
      {
        generatedAt: now.toISOString(),
        slaMinutes,
        vehiclesByState: vehiclesByState.map((entry) => ({
          state: entry.pipelineState,
          count: entry._count._all,
        })),
        slaBreaches: {
          count: slaBreaches.length,
          vehicles: slaBreaches,
        },
        blockers: blockers.map((entry) => ({
          type: entry.type,
          count: entry._count._all,
        })),
        qcBacklog: qcBacklog.map((entry) => ({
          status: entry.status,
          count: entry._count._all,
        })),
        washersQueue: washersQueue.map((entry) => ({
          status: entry.status,
          count: entry._count._all,
        })),
        stationThroughputLast24h: stationThroughput.map((entry) => ({
          stationId: entry.stationId,
          completed: entry._count._all,
        })),
        assignmentSuggestions,
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build control tower summary.";
    return apiError({ requestId, code: "CONTROL_TOWER_FAILED", message, status: 500 });
  }
}
