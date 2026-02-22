import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  fetchFeedRaw,
  parseRssFeed,
  processFeedItems,
} from "@/lib/feeds/scanner";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

const MAX_SOURCES_PER_RUN = 20;
const FETCH_TIMEOUT_MS = 15_000;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in dev when no secret configured
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find sources due for scanning
    const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const sources = await db.feedSource.findMany({
      where: {
        OR: [
          { lastScannedAt: null },
          { lastScannedAt: { lt: cutoff } },
        ],
      },
      take: MAX_SOURCES_PER_RUN,
      orderBy: { lastScannedAt: "asc" },
    });

    const results: Array<{ sourceId: string; name: string; newItems: number; error?: string }> = [];

    for (const source of sources) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const { xml, etag, notModified } = await fetchFeedRaw(source.url, source.lastEtag);
        clearTimeout(timer);

        if (notModified) {
          await db.feedSource.update({
            where: { id: source.id },
            data: { lastScannedAt: new Date() },
          });
          results.push({ sourceId: source.id, name: source.name, newItems: 0 });
          continue;
        }

        const rawItems = parseRssFeed(xml);
        const scored = processFeedItems(rawItems);

        let newCount = 0;
        for (const item of scored) {
          const existing = await db.feedItem.findUnique({
            where: { workspaceId_urlHash: { workspaceId: source.workspaceId, urlHash: item.urlHash } },
          });
          if (!existing) {
            await db.feedItem.create({
              data: {
                workspaceId: source.workspaceId,
                sourceId: source.id,
                title: item.title,
                summary: item.summary ?? null,
                url: item.url,
                urlHash: item.urlHash,
                category: item.category,
                relevanceScore: item.relevanceScore,
                keywords: item.keywords.join(","),
                publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
              },
            });
            newCount++;
          }
        }

        await db.feedSource.update({
          where: { id: source.id },
          data: { lastScannedAt: new Date(), lastEtag: etag ?? null },
        });

        results.push({ sourceId: source.id, name: source.name, newItems: newCount });
      } catch (err) {
        results.push({
          sourceId: source.id,
          name: source.name,
          newItems: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.newItems, 0);
    return NextResponse.json({
      ok: true,
      sourcesScanned: results.length,
      totalNewItems: totalNew,
      results,
    });
  } catch (err) {
    if (isSchemaNotReadyError(err)) {
      return NextResponse.json({ ok: false, error: "Feeds schema not ready" }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 },
    );
  }
}
