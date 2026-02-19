import { NextResponse } from "next/server";

import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";

  try {
    await requireWorkspacePermission(workspaceId, "shifts", "read");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 403 });
  }

  const shifts = await db.shift.findMany({
    where: { workspaceId },
    include: {
      assignee: {
        select: {
          loginName: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      startsAt: "asc",
    },
  });

  const headers = [
    "id",
    "title",
    "assignedLoginName",
    "assignedName",
    "startsAt",
    "endsAt",
    "status",
    "notes",
  ];

  const rows = shifts.map((shift) => [
    shift.id,
    shift.title,
    shift.assignee?.loginName ?? shift.assignee?.email ?? "",
    shift.assignee?.name ?? "",
    shift.startsAt.toISOString(),
    shift.endsAt.toISOString(),
    shift.status,
    shift.notes ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
    .join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shifts-${workspaceId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
