import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";

const querySchema = z.object({
  workspaceId: z.string().min(1),
  q: z.string().trim().min(2),
  entity: z.enum(["vehicle", "incident", "feed", "message", "work_order", "all"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  savedViewId: z.string().min(1).optional(),
});

type RankedResult = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  score: number;
  reasons: string[];
};

function addDateFilter<T>(
  items: T[],
  resolveDate: (item: T) => Date | null | undefined,
  from?: Date,
  to?: Date,
) {
  if (!from && !to) return items;

  return items.filter((item) => {
    const date = resolveDate(item);
    if (!date) return true;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    q: searchParams.get("q") ?? "",
    entity: searchParams.get("entity") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    savedViewId: searchParams.get("savedViewId") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "Invalid search query.", status: 400 });
  }

  try {
    await requireWorkspacePermission(parsed.data.workspaceId, "data", "read");

    let entity = parsed.data.entity ?? "all";
    if (parsed.data.savedViewId) {
      const savedView = await db.savedView.findFirst({
        where: {
          id: parsed.data.savedViewId,
          workspaceId: parsed.data.workspaceId,
          module: "search",
        },
      });

      if (savedView?.filtersJson && typeof savedView.filtersJson === "object") {
        const filters = savedView.filtersJson as { entity?: string; severity?: string };
        entity = (filters.entity as typeof entity) ?? entity;
      }
    }

    const q = parsed.data.q;
    const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
    const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
    const results: RankedResult[] = [];

    if (entity === "all" || entity === "vehicle") {
      const vehicles = await db.vehicle.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          OR: [
            { plateNumber: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 20,
      });

      for (const vehicle of vehicles) {
        const reasons: string[] = [];
        if (vehicle.plateNumber.toLowerCase().includes(q.toLowerCase())) reasons.push("plateNumber match");
        if (vehicle.model.toLowerCase().includes(q.toLowerCase())) reasons.push("model match");
        if ((vehicle.notes ?? "").toLowerCase().includes(q.toLowerCase())) reasons.push("notes match");

        results.push({
          type: "vehicle",
          id: vehicle.id,
          title: vehicle.plateNumber,
          subtitle: `${vehicle.model} · ${vehicle.pipelineState}`,
          score: reasons.length + (vehicle.pipelineState === "BLOCKED" ? 0.5 : 0),
          reasons,
        });
      }
    }

    if (entity === "all" || entity === "incident") {
      const incidents = await db.incident.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          ...(parsed.data.severity ? { severity: parsed.data.severity } : {}),
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { claimRef: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 20,
      });

      for (const incident of addDateFilter(incidents, (item) => item.createdAt, from, to)) {
        const reasons: string[] = [];
        if (incident.title.toLowerCase().includes(q.toLowerCase())) reasons.push("title match");
        if ((incident.description ?? "").toLowerCase().includes(q.toLowerCase())) reasons.push("description match");
        if (parsed.data.severity && incident.severity === parsed.data.severity) reasons.push("severity filter");

        results.push({
          type: "incident",
          id: incident.id,
          title: incident.title,
          subtitle: `${incident.severity} · ${incident.status}`,
          score: reasons.length + (incident.severity === "CRITICAL" ? 1 : 0),
          reasons,
        });
      }
    }

    if (entity === "all" || entity === "feed") {
      const feeds = await db.feedItem.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { keywords: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [{ relevanceScore: "desc" }, { createdAt: "desc" }],
        take: 20,
      });

      for (const feed of addDateFilter(feeds, (item) => item.publishedAt ?? item.createdAt, from, to)) {
        const reasons: string[] = [];
        if (feed.title.toLowerCase().includes(q.toLowerCase())) reasons.push("title match");
        if ((feed.summary ?? "").toLowerCase().includes(q.toLowerCase())) reasons.push("summary match");
        if ((feed.keywords ?? "").toLowerCase().includes(q.toLowerCase())) reasons.push("keywords match");

        results.push({
          type: "feed",
          id: feed.id,
          title: feed.title,
          subtitle: `${feed.category} · ${(feed.relevanceScore * 100).toFixed(0)}%`,
          score: reasons.length + feed.relevanceScore,
          reasons,
        });
      }
    }

    if (entity === "all" || entity === "work_order") {
      const workOrders = await db.workOrder.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { vehicleId: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 20,
      });

      for (const order of addDateFilter(workOrders, (item) => item.createdAt, from, to)) {
        const reasons: string[] = [];
        if (order.title.toLowerCase().includes(q.toLowerCase())) reasons.push("title match");
        if ((order.description ?? "").toLowerCase().includes(q.toLowerCase())) reasons.push("description match");
        if ((order.vehicleId ?? "").toLowerCase().includes(q.toLowerCase())) reasons.push("vehicleId match");

        results.push({
          type: "work_order",
          id: order.id,
          title: order.title,
          subtitle: `${order.status} · priority ${order.priority}`,
          score: reasons.length + (order.priority >= 4 ? 0.5 : 0),
          reasons,
        });
      }
    }

    if (entity === "all" || entity === "message") {
      const messages = await db.chatMessage.findMany({
        where: {
          thread: {
            workspaceId: parsed.data.workspaceId,
          },
          content: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          content: true,
          thread: { select: { title: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      for (const message of addDateFilter(messages, (item) => item.createdAt, from, to)) {
        results.push({
          type: "message",
          id: message.id,
          title: `Message in ${message.thread.title}`,
          subtitle: message.content.slice(0, 120),
          score: 1,
          reasons: ["content match"],
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return apiSuccess(
      {
        query: {
          ...parsed.data,
          entity,
        },
        results: results.slice(0, parsed.data.limit ?? 50),
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "SEARCH_V2_FAILED",
      message: error instanceof Error ? error.message : "Search failed.",
      status: 500,
    });
  }
}
