import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/app-context";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

const MAX_RESULTS = 20;

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const workspaceId = url.searchParams.get("workspaceId");

  if (!q || q.length < 2) {
    return Response.json(
      { results: [], query: q },
      withObservabilityHeaders({ status: 200 }, requestId),
    );
  }

  try {
    if (workspaceId) {
      await getAppContext(workspaceId);
    }

    const wId = workspaceId;
    const results: Array<{ type: string; id: string; title: string; subtitle?: string; url?: string }> = [];

    // Search washer tasks by notes
    try {
      const tasks = await db.washerTask.findMany({
        where: {
          ...(wId ? { workspaceId: wId } : {}),
          notes: { contains: q, mode: "insensitive" as const },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true, vehicle: { select: { plateNumber: true } } },
      });
      for (const t of tasks) {
        results.push({
          type: "task",
          id: t.id,
          title: `Task: ${t.vehicle.plateNumber}`,
          subtitle: `${t.status} · ${t.createdAt.toLocaleDateString()}`,
          url: "/washers",
        });
      }
    } catch (err) {
      if (!isSchemaNotReadyError(err)) throw err;
    }

    // Search vehicles
    try {
      const vehicles = await db.vehicle.findMany({
        where: {
          ...(wId ? { workspaceId: wId } : {}),
          OR: [
            { plateNumber: { contains: q, mode: "insensitive" as const } },
            { model: { contains: q, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, plateNumber: true, model: true, status: true },
      });
      for (const v of vehicles) {
        results.push({
          type: "vehicle",
          id: v.id,
          title: `Vehicle: ${v.plateNumber}`,
          subtitle: `${v.model ?? ""} · ${v.status}`,
          url: "/fleet",
        });
      }
    } catch (err) {
      if (!isSchemaNotReadyError(err)) throw err;
    }

    // Search chat threads
    try {
      const threads = await db.chatThread.findMany({
        where: {
          ...(wId ? { workspaceId: wId } : {}),
          title: { contains: q, mode: "insensitive" as const },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      });
      for (const t of threads) {
        results.push({
          type: "thread",
          id: t.id,
          title: `Chat: ${t.title}`,
          url: "/chat",
        });
      }
    } catch (err) {
      if (!isSchemaNotReadyError(err)) throw err;
    }

    // Search users/staff
    try {
      const users = await db.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        },
        take: 5,
        select: { id: true, name: true, email: true },
      });
      for (const u of users) {
        results.push({
          type: "user",
          id: u.id,
          title: u.name ?? u.email,
          subtitle: u.email,
          url: "/settings",
        });
      }
    } catch (err) {
      if (!isSchemaNotReadyError(err)) throw err;
    }

    return Response.json(
      { results: results.slice(0, MAX_RESULTS), query: q },
      withObservabilityHeaders({ status: 200 }, requestId),
    );
  } catch (err) {
    if (isSchemaNotReadyError(err)) {
      return Response.json(
        { results: [], query: q, error: "Search not available" },
        withObservabilityHeaders({ status: 200 }, requestId),
      );
    }
    return Response.json(
      { results: [], query: q, error: "Search failed" },
      withObservabilityHeaders({ status: 500 }, requestId),
    );
  }
}
