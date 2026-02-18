import { ShiftStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import { isSameOriginRequest } from "@/lib/security";
import { moveShiftSchema } from "@/lib/validators/shifts";

type RouteContext = {
  params: Promise<{ shiftId: string }>;
};

function parseTargetDate(targetDateIso: string, sourceDate: Date) {
  const [year, month, day] = targetDateIso.split("-").map((value) => Number.parseInt(value, 10));

  if (!year || !month || !day) {
    throw new Error("Invalid target date.");
  }

  return new Date(
    year,
    month - 1,
    day,
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds(),
  );
}

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const { shiftId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = moveShiftSchema.safeParse({
    shiftId,
    ...(payload as Record<string, unknown>),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid move payload.",
      },
      { status: 400 },
    );
  }

  try {
    const { user } = await requireWorkspacePermission(
      parsed.data.workspaceId,
      "shifts",
      "write",
    );

    const shift = await db.shift.findFirst({
      where: {
        id: parsed.data.shiftId,
        workspaceId: parsed.data.workspaceId,
      },
    });

    if (!shift) {
      return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });
    }

    const nextStartsAt = parseTargetDate(parsed.data.targetDateIso, shift.startsAt);
    const durationMs = shift.endsAt.getTime() - shift.startsAt.getTime();
    const nextEndsAt = new Date(nextStartsAt.getTime() + durationMs);

    if (shift.assignedUserId) {
      const overlap = await db.shift.findFirst({
        where: {
          workspaceId: parsed.data.workspaceId,
          assignedUserId: shift.assignedUserId,
          id: { not: shift.id },
          status: {
            not: ShiftStatus.CANCELLED,
          },
          startsAt: {
            lt: nextEndsAt,
          },
          endsAt: {
            gt: nextStartsAt,
          },
        },
        select: { id: true },
      });

      if (overlap) {
        return NextResponse.json(
          {
            ok: false,
            message: "Shift conflict detected on target day.",
          },
          { status: 409 },
        );
      }
    }

    const updated = await db.shift.update({
      where: { id: shift.id },
      data: {
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "shift.moved",
      entityType: "shift",
      entityId: shift.id,
      metaJson: {
        startsAt: updated.startsAt.toISOString(),
        endsAt: updated.endsAt.toISOString(),
      },
    });

    revalidatePath("/shifts");
    revalidatePath("/calendar");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error.",
      },
      { status: 500 },
    );
  }
}
