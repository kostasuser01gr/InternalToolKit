import { format } from "date-fns";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { getWorkspaceForUser, getDefaultWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const dateParam = url.searchParams.get("date");

  const membership = workspaceId
    ? await getWorkspaceForUser(session.user.id, workspaceId)
    : await getDefaultWorkspaceForUser(session.user.id);

  if (!membership) {
    return Response.json({ ok: false, message: "Workspace not found." }, { status: 403 });
  }

  const date = dateParam ? new Date(dateParam) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const tasks = await db.washerTask.findMany({
    where: {
      workspaceId: membership.workspace.id,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: { vehicle: true, washer: true },
    orderBy: { createdAt: "desc" },
  });

  const header = "ID,Vehicle Plate,Vehicle Model,Status,Exterior,Interior,Vacuum,Washer,Station,Device,Notes,Created At\n";
  const rows = tasks
    .map((t) =>
      [
        t.id,
        `"${t.vehicle.plateNumber}"`,
        `"${t.vehicle.model}"`,
        t.status,
        t.exteriorDone ? "Yes" : "No",
        t.interiorDone ? "Yes" : "No",
        t.vacuumDone ? "Yes" : "No",
        `"${t.washer?.name ?? "Kiosk"}"`,
        `"${t.stationId ?? ""}"`,
        `"${t.deviceId ?? ""}"`,
        `"${(t.notes ?? "").replace(/"/g, '""')}"`,
        format(t.createdAt, "yyyy-MM-dd HH:mm:ss"),
      ].join(","),
    )
    .join("\n");

  const csv = header + rows;
  const filename = `wash-tasks-${format(date, "yyyy-MM-dd")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
