import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/app-context";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

const MAX_RESULTS = 20;
const MIN_SIMILARITY = 0.15;

type SearchResult = { type: string; id: string; title: string; subtitle?: string; url?: string; score?: number };

/**
 * Trigram search helper — uses pg_trgm similarity() + ILIKE fallback.
 * Returns scored results sorted by relevance.
 */
async function trigramSearch<T extends { id: string }>(
  table: string,
  columns: string[],
  q: string,
  workspaceIdCol: string | null,
  wId: string | null,
  limit: number,
  extraWhere?: string,
): Promise<(T & { _score: number })[]> {
  const similarityExprs = columns.map(
    (c) => `COALESCE(similarity(${c}, $1), 0)`,
  );
  const scoreExpr = similarityExprs.join(" + ");
  const ilikeExprs = columns.map((c) => `${c} ILIKE $2`).join(" OR ");

  let whereClause = `(${ilikeExprs} OR (${scoreExpr}) > ${MIN_SIMILARITY})`;
  if (workspaceIdCol && wId) {
    whereClause = `"${workspaceIdCol}" = '${wId}' AND ${whereClause}`;
  }
  if (extraWhere) {
    whereClause = `${whereClause} AND ${extraWhere}`;
  }

  const sql = `SELECT *, (${scoreExpr}) AS "_score" FROM "${table}" WHERE ${whereClause} ORDER BY "_score" DESC LIMIT ${limit}`;

  try {
    return await db.$queryRawUnsafe(sql, q, `%${q}%`);
  } catch {
    return [];
  }
}

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
    const results: SearchResult[] = [];

    // Vehicles — trigram on plateNumber + model
    try {
      const vehicles = await trigramSearch<{ id: string; plateNumber: string; model: string | null; status: string }>(
        "Vehicle", ['"plateNumber"', '"model"'], q, "workspaceId", wId, 5,
      );
      for (const v of vehicles) {
        results.push({
          type: "vehicle", id: v.id,
          title: `Vehicle: ${v.plateNumber}`,
          subtitle: `${v.model ?? ""} · ${v.status}`,
          url: "/fleet", score: v._score,
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Chat threads — trigram on title
    try {
      const threads = await trigramSearch<{ id: string; title: string }>(
        "ChatThread", ['"title"'], q, "workspaceId", wId, 5,
      );
      for (const t of threads) {
        results.push({
          type: "thread", id: t.id,
          title: `Chat: ${t.title}`,
          url: "/chat", score: t._score,
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Users — trigram on name + email
    try {
      const users = await trigramSearch<{ id: string; name: string | null; email: string }>(
        "User", ['"name"', '"email"'], q, null, null, 5,
      );
      for (const u of users) {
        results.push({
          type: "user", id: u.id,
          title: u.name ?? u.email,
          subtitle: u.email,
          url: "/settings", score: u._score,
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Shifts — trigram on title
    try {
      const shifts = await trigramSearch<{ id: string; title: string; status: string; startsAt: Date }>(
        "Shift", ['"title"'], q, "workspaceId", wId, 5,
      );
      for (const s of shifts) {
        results.push({
          type: "shift", id: s.id,
          title: `Shift: ${s.title}`,
          subtitle: `${s.status} · ${new Date(s.startsAt).toLocaleDateString()}`,
          url: "/shifts", score: s._score,
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Feed items — trigram on title + summary
    try {
      const feedItems = await trigramSearch<{ id: string; title: string; category: string }>(
        "FeedItem", ['"title"', '"summary"'], q, "workspaceId", wId, 5,
      );
      for (const f of feedItems) {
        results.push({
          type: "feed", id: f.id,
          title: `Feed: ${f.title}`,
          subtitle: f.category,
          url: "/feeds", score: f._score,
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Washer tasks — trigram on notes (vehicle plate via join is complex, keep Prisma)
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
          type: "task", id: t.id,
          title: `Task: ${t.vehicle.plateNumber}`,
          subtitle: `${t.status} · ${t.createdAt.toLocaleDateString()}`,
          url: "/washers",
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Full-text search for chat messages (RBAC) — uses Postgres FTS with ILIKE fallback
    try {
      const { user } = await getAppContext(wId ?? undefined);

      let memberChannelIds: string[] = [];
      try {
        const memberships = await db.chatChannelMember.findMany({
          where: { userId: user.id },
          select: { channelId: true },
        });
        memberChannelIds = memberships.map((m) => m.channelId);
      } catch {
        // schema not ready
      }

      const publicChannelIds = await db.chatChannel.findMany({
        where: { type: "PUBLIC", ...(wId ? { workspaceId: wId } : {}) },
        select: { id: true },
      }).then((cs) => cs.map((c) => c.id)).catch(() => []);

      const allowedChannelIds = [...new Set([...publicChannelIds, ...memberChannelIds])];

      // Try FTS first (plainto_tsquery), fall back to ILIKE
      let messages: Array<{ id: string; content: string; threadId: string; thread: { title: string } }> = [];
      if (allowedChannelIds.length > 0 && q.length >= 3) {
        try {
          const ftsResults = await db.$queryRawUnsafe<Array<{ id: string; content: string; threadId: string }>>(
            `SELECT m."id", m."content", m."threadId"
             FROM "ChatMessage" m
             JOIN "ChatThread" t ON m."threadId" = t."id"
             WHERE t."channelId" = ANY($1::text[])
             AND to_tsvector('simple', m."content") @@ plainto_tsquery('simple', $2)
             ORDER BY m."createdAt" DESC LIMIT 5`,
            allowedChannelIds,
            q,
          );
          if (ftsResults.length > 0) {
            const threadIds = [...new Set(ftsResults.map((r) => r.threadId))];
            const threads = await db.chatThread.findMany({
              where: { id: { in: threadIds } },
              select: { id: true, title: true },
            });
            const threadMap = new Map(threads.map((t) => [t.id, t]));
            messages = ftsResults.map((r) => ({
              ...r,
              thread: threadMap.get(r.threadId) ?? { title: "Chat" },
            }));
          }
        } catch {
          // FTS not available, fall through to ILIKE
        }
      }

      // ILIKE fallback
      if (messages.length === 0) {
        messages = await db.chatMessage.findMany({
          where: {
            content: { contains: q, mode: "insensitive" as const },
            thread: {
              ...(wId ? { workspaceId: wId } : {}),
              OR: [
                { channelId: null },
                ...(allowedChannelIds.length > 0 ? [{ channelId: { in: allowedChannelIds } }] : []),
              ],
            },
          },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, content: true, threadId: true, thread: { select: { title: true } } },
        });
      }

      for (const m of messages) {
        results.push({
          type: "message", id: m.id,
          title: `Message in "${m.thread.title}"`,
          subtitle: m.content.slice(0, 80),
          url: "/chat",
        });
      }
    } catch (err) {
      if (!isDatabaseUnavailableError(err)) throw err;
    }

    // Sort all results by score descending (scored results first)
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return Response.json(
      { results: results.slice(0, MAX_RESULTS), query: q },
      withObservabilityHeaders({ status: 200 }, requestId),
    );
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
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
