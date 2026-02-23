import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  fetchFeedRaw,
  parseRssFeed,
  processFeedItems,
} from "@/lib/feeds/scanner";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { retryDeadLetters } from "@/lib/viber/bridge";

const MAX_SOURCES_PER_RUN = 20;
const FETCH_TIMEOUT_MS = 15_000;
const FEED_ITEM_RETENTION_DAYS = 90;
const INTER_SOURCE_DELAY_MS = 1_000; // Rate limit: 1s between sources

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Legacy feed-only cron endpoint — kept for backward compatibility.
 * The consolidated daily cron is at /api/cron/daily.
 */
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
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        results.push({
          sourceId: source.id,
          name: source.name,
          newItems: 0,
          error: errorMsg,
        });
        // Dead-letter: record failed scan for retry
        try {
          await db.deadLetterEntry.create({
            data: {
              workspaceId: source.workspaceId,
              type: "feed_scan",
              payload: JSON.stringify({ sourceId: source.id, url: source.url }),
              error: errorMsg,
              attempts: 1,
            },
          });
        } catch {
          // non-critical
        }
      }

      // Rate limit between sources
      if (sources.indexOf(source) < sources.length - 1) {
        await new Promise((r) => setTimeout(r, INTER_SOURCE_DELAY_MS));
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.newItems, 0);

    // Housekeeping: purge old unpinned feed items
    let purgedCount = 0;
    try {
      const retentionCutoff = new Date(Date.now() - FEED_ITEM_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const purged = await db.feedItem.deleteMany({
        where: { fetchedAt: { lt: retentionCutoff }, isPinned: false },
      });
      purgedCount = purged.count;
    } catch {
      // non-critical
    }

    // Housekeeping: retry Viber dead letters
    let viberRetry = { retried: 0, succeeded: 0 };
    try {
      viberRetry = await retryDeadLetters();
    } catch {
      // non-critical
    }

    return NextResponse.json({
      ok: true,
      sourcesScanned: results.length,
      totalNewItems: totalNew,
      housekeeping: { purgedFeedItems: purgedCount, viberRetried: viberRetry.retried, viberSucceeded: viberRetry.succeeded },
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
