"use server";

import { ShiftRequestStatus, ShiftStatus, WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import {
  AuthError,
  requireWorkspacePermission,
  requireWorkspaceRole,
} from "@/lib/rbac";
import {
  createShiftRequestSchema,
  createShiftSchema,
  importShiftsCsvSchema,
  reviewShiftRequestSchema,
} from "@/lib/validators/shifts";

function buildShiftsUrl(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `/shifts?${queryString}` : "/shifts";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

function normalizeDateTimeInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString();
}

async function assertNoShiftConflict(input: {
  workspaceId: string;
  assignedUserId?: string;
  startsAt: Date;
  endsAt: Date;
  ignoredShiftId?: string;
}) {
  if (!input.assignedUserId) {
    return;
  }

  const overlapping = await db.shift.findFirst({
    where: {
      workspaceId: input.workspaceId,
      assignedUserId: input.assignedUserId,
      ...(input.ignoredShiftId ? { id: { not: input.ignoredShiftId } } : {}),
      startsAt: {
        lt: input.endsAt,
      },
      endsAt: {
        gt: input.startsAt,
      },
      status: {
        not: ShiftStatus.CANCELLED,
      },
    },
    select: { id: true, title: true },
  });

  if (overlapping) {
    throw new Error(
      `Shift conflict detected with "${overlapping.title}". Adjust assignment or times.`,
    );
  }
}

export async function createShiftAction(formData: FormData) {
  const parsed = createShiftSchema.parse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    assignedUserId: formData.get("assignedUserId") || undefined,
    startsAt: normalizeDateTimeInput(formData.get("startsAt")),
    endsAt: normalizeDateTimeInput(formData.get("endsAt")),
    notes: formData.get("notes") || undefined,
    status: formData.get("status") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "shifts",
      "write",
    );

    const startsAt = new Date(parsed.startsAt);
    const endsAt = new Date(parsed.endsAt);

    await assertNoShiftConflict({
      workspaceId: parsed.workspaceId,
      startsAt,
      endsAt,
      ...(parsed.assignedUserId
        ? { assignedUserId: parsed.assignedUserId }
        : {}),
    });

    const shift = await db.shift.create({
      data: {
        workspaceId: parsed.workspaceId,
        createdBy: user.id,
        assignedUserId: parsed.assignedUserId ?? null,
        title: parsed.title,
        startsAt,
        endsAt,
        notes: parsed.notes ?? null,
        status: parsed.status ?? ShiftStatus.PUBLISHED,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "shift.created",
      entityType: "shift",
      entityId: shift.id,
      metaJson: {
        assignedUserId: parsed.assignedUserId,
        startsAt: shift.startsAt.toISOString(),
        endsAt: shift.endsAt.toISOString(),
      },
    });

    revalidatePath("/shifts");
    revalidatePath("/calendar");
    redirect(buildShiftsUrl({ success: "Shift created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildShiftsUrl({ error: getErrorMessage(error) }));
  }
}

export async function importShiftsCsvAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    redirect(buildShiftsUrl({ error: "CSV file is required." }));
  }

  const csvContent = await file.text();
  const parsedInput = importShiftsCsvSchema.parse({
    workspaceId,
    csvContent,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsedInput.workspaceId,
      "shifts",
      "write",
    );

    const parsedCsv = Papa.parse<Record<string, string>>(parsedInput.csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsedCsv.data;
    if (rows.length === 0) {
      throw new Error("CSV import payload is empty.");
    }

    const users = await db.workspaceMember.findMany({
      where: { workspaceId: parsedInput.workspaceId },
      include: { user: true },
    });

    const userByLogin = new Map(
      users
        .map((member) => member.user)
        .filter((member) => member.loginName)
        .map((member) => [member.loginName?.toLowerCase() as string, member.id]),
    );

    let imported = 0;

    for (const row of rows) {
      const title = row.title?.trim();
      const startsAtRaw = row.startsAt?.trim();
      const endsAtRaw = row.endsAt?.trim();

      if (!title || !startsAtRaw || !endsAtRaw) {
        continue;
      }

      const startsAt = new Date(startsAtRaw);
      const endsAt = new Date(endsAtRaw);

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        continue;
      }

      const assignedUserId = row.assignedLoginName
        ? userByLogin.get(row.assignedLoginName.toLowerCase())
        : undefined;

      await assertNoShiftConflict({
        workspaceId: parsedInput.workspaceId,
        startsAt,
        endsAt,
        ...(assignedUserId ? { assignedUserId } : {}),
      });

      await db.shift.create({
        data: {
          workspaceId: parsedInput.workspaceId,
          createdBy: user.id,
          assignedUserId: assignedUserId ?? null,
          title,
          startsAt,
          endsAt,
          status: ShiftStatus.PUBLISHED,
          notes: row.notes?.trim() || null,
        },
      });

      imported += 1;
    }

    await appendAuditLog({
      workspaceId: parsedInput.workspaceId,
      actorUserId: user.id,
      action: "shift.csv_imported",
      entityType: "shift",
      entityId: parsedInput.workspaceId,
      metaJson: { imported },
    });

    revalidatePath("/shifts");
    revalidatePath("/calendar");
    redirect(buildShiftsUrl({ success: `Imported ${imported} shifts from CSV.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildShiftsUrl({ error: getErrorMessage(error) }));
  }
}

export async function createShiftRequestAction(formData: FormData) {
  const parsed = createShiftRequestSchema.parse({
    workspaceId: formData.get("workspaceId"),
    shiftId: formData.get("shiftId") || undefined,
    type: formData.get("type"),
    startsAt: normalizeDateTimeInput(formData.get("startsAt")),
    endsAt: normalizeDateTimeInput(formData.get("endsAt")),
    reason: formData.get("reason"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
      WorkspaceRole.VIEWER,
    ]);

    const request = await db.shiftRequest.create({
      data: {
        workspaceId: parsed.workspaceId,
        requesterId: user.id,
        shiftId: parsed.shiftId ?? null,
        type: parsed.type,
        startsAt: new Date(parsed.startsAt),
        endsAt: new Date(parsed.endsAt),
        reason: parsed.reason,
      },
    });

    const adminMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId: parsed.workspaceId,
        role: WorkspaceRole.ADMIN,
      },
      select: { userId: true },
    });

    if (adminMembers.length > 0) {
      await db.notification.createMany({
        data: adminMembers.map((member) => ({
          userId: member.userId,
          type: "shift_request",
          title: "New shift request",
          body: `${user.name} submitted ${parsed.type.toLowerCase()} request.`,
        })),
      });
    }

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "shift.request_created",
      entityType: "shift_request",
      entityId: request.id,
      metaJson: {
        type: parsed.type,
      },
    });

    revalidatePath("/shifts");
    revalidatePath("/calendar");
    redirect(buildShiftsUrl({ success: "Shift request submitted." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildShiftsUrl({ error: getErrorMessage(error) }));
  }
}

export async function reviewShiftRequestAction(formData: FormData) {
  const parsed = reviewShiftRequestSchema.parse({
    workspaceId: formData.get("workspaceId"),
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "shifts",
      "approve_requests",
    );

    const nextStatus =
      parsed.decision === "approve"
        ? ShiftRequestStatus.APPROVED
        : ShiftRequestStatus.REJECTED;

    const request = await db.shiftRequest.update({
      where: { id: parsed.requestId },
      data: {
        status: nextStatus,
      },
      include: {
        requester: true,
      },
    });

    await db.notification.create({
      data: {
        userId: request.requesterId,
        type: "shift_request",
        title: "Shift request reviewed",
        body: `Your request was ${nextStatus.toLowerCase()}.`,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "shift.request_reviewed",
      entityType: "shift_request",
      entityId: request.id,
      metaJson: {
        status: nextStatus,
      },
    });

    revalidatePath("/shifts");
    revalidatePath("/calendar");
    redirect(buildShiftsUrl({ success: `Request ${nextStatus.toLowerCase()}.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildShiftsUrl({ error: getErrorMessage(error) }));
  }
}
