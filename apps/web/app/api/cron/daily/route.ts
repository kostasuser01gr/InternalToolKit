import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  fetchFeedRaw,
  parseRssFeed,
  processFeedItems,
} from "@/lib/feeds/scanner";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { isViberBridgeReady, mirrorToViber, retryDeadLetters } from "@/lib/viber/bridge";
import { DEFAULT_STATIONS, fetchWeatherSafe } from "@/lib/weather/client";

/**
 * Consolidated daily cron — runs feeds scan + weather cache warm + housekeeping.
 * Vercel Hobby plan allows only 1 cron at daily frequency.
 * Schedule: 0 6 * * * (daily at 06:00 UTC)
 * Protected by CRON_SECRET header.
 */

const MAX_SOURCES_PER_RUN = 20;
const FETCH_TIMEOUT_MS = 15_000;
const FEED_ITEM_RETENTION_DAYS = 90;
const CRON_LOG_RETENTION_DAYS = 30;
const MAX_RETRY_ATTEMPTS = 3;

/** Bounded retry with exponential backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = MAX_RETRY_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  // Log to dead-letter on final failure
  try {
    await db.deadLetterEntry.create({
      data: {
        type: `cron-${label}`,
        payload: label,
        error: lastError instanceof Error ? lastError.message : "Unknown error",
        attempts: maxAttempts,
      },
    });
  } catch {
    // non-critical
  }
  throw lastError;
}

// Persist cron run to database (replaces in-memory log)
async function logRunToDB(entry: {
  job: string;
  startedAt: Date;
  finishedAt: Date;
  status: string;
  itemsProcessed: number;
  errorSummary?: string;
}) {
  try {
    await db.cronRun.create({
      data: {
        job: entry.job,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
        status: entry.status,
        itemsProcessed: entry.itemsProcessed,
        errorSummary: entry.errorSummary ?? null,
      },
    });
  } catch {
    // non-critical: DB write failure shouldn't break cron
  }
}

export async function getCronRunLog() {
  try {
    return await db.cronRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    return [];
  }
}

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in dev
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runStart = new Date();
  const jobs: Record<string, unknown> = {};

  // ── Job 1: Feed Scanning ──
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const sources = await db.feedSource.findMany({
      where: {
        OR: [
          { lastScannedAt: null },
          { lastScannedAt: { lt: cutoff } },
        ],
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        url: true,
        lastEtag: true,
        lastScannedAt: true,
        keywordsJson: true,
      },
      take: MAX_SOURCES_PER_RUN,
      orderBy: { lastScannedAt: "asc" },
    });

    const results: Array<{ sourceId: string; name: string; newItems: number; error?: string }> = [];

    for (const source of sources) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const { xml, etag, notModified } = await withRetry(
          () => fetchFeedRaw(source.url, source.lastEtag),
          `feeds:${source.name}`,
        );
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
        const sourceKw = source.keywordsJson as { boost?: string[]; suppress?: string[] } | null;
        const scored = processFeedItems(rawItems, sourceKw);

        let newCount = 0;
        for (const item of scored) {
          const existing = await db.feedItem.findUnique({
            where: { workspaceId_urlHash: { workspaceId: source.workspaceId, urlHash: item.urlHash } },
          });
          if (!existing) {
            const created = await db.feedItem.create({
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

            // Auto-pin high-relevance items and notify coordinators
            if (item.relevanceScore >= 0.8) {
              await db.feedItem.update({
                where: { id: created.id },
                data: { isPinned: true },
              });

              // Create notification for workspace admins
              try {
                const admins = await db.workspaceMember.findMany({
                  where: { workspaceId: source.workspaceId, role: { in: ["ADMIN", "EDITOR"] } },
                  select: { userId: true },
                });
                for (const admin of admins) {
                  await db.notification.create({
                    data: {
                      userId: admin.userId,
                      type: "FEED_HIGH_RELEVANCE",
                      title: `📌 High-relevance feed: ${item.title.slice(0, 80)}`,
                      body: `${item.category} — Score ${(item.relevanceScore * 100).toFixed(0)}%. Auto-pinned.`,
                    },
                  });
                }
              } catch {
                // non-critical: notification creation failure should not break feed scan
              }

              // Auto-mirror high-relevance feeds to Viber channel
              try {
                if (isViberBridgeReady()) {
                  await mirrorToViber({
                    id: created.id,
                    channelSlug: "ops-general",
                    content: `📰 ${item.category}: ${item.title}\n${item.summary?.slice(0, 200) ?? ""}\nRelevance: ${(item.relevanceScore * 100).toFixed(0)}%`,
                    authorName: "Feed Scanner",
                    timestamp: new Date(),
                  });
                }
              } catch {
                // non-critical: Viber mirror failure should not break feed scan
              }
            }
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
    jobs.feeds = { sourcesScanned: results.length, totalNewItems: totalNew, results };
    await logRunToDB({ job: "feeds", startedAt: runStart, finishedAt: new Date(), status: "ok", itemsProcessed: totalNew });
  } catch (err) {
    const msg = isDatabaseUnavailableError(err) ? "Schema not ready" : (err instanceof Error ? err.message : "Failed");
    jobs.feeds = { error: msg };
    await logRunToDB({ job: "feeds", startedAt: runStart, finishedAt: new Date(), status: "error", itemsProcessed: 0, errorSummary: msg });
  }

  // ── Job 2: Weather Cache Warm ──
  try {
    const stationIds = Object.keys(DEFAULT_STATIONS);
    let warmed = 0;
    for (const sid of stationIds) {
      try {
        const data = await withRetry(
          () => fetchWeatherSafe(sid),
          `weather:${sid}`,
        );
        if (data) warmed++;
      } catch {
        // individual station failure logged to dead-letter by withRetry
      }
    }
    jobs.weather = { stationsWarmed: warmed, total: stationIds.length };
    await logRunToDB({ job: "weather", startedAt: runStart, finishedAt: new Date(), status: "ok", itemsProcessed: warmed });
  } catch (err) {
    jobs.weather = { error: err instanceof Error ? err.message : "Failed" };
    await logRunToDB({ job: "weather", startedAt: runStart, finishedAt: new Date(), status: "error", itemsProcessed: 0, errorSummary: "Failed" });
  }

  // ── Job 3: Housekeeping ──
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

  let viberRetry = { retried: 0, succeeded: 0 };
  try {
    viberRetry = await retryDeadLetters();
  } catch {
    // non-critical
  }

  // Purge old cron logs and resolved dead-letter entries
  let cronLogsPurged = 0;
  try {
    const cronCutoff = new Date(Date.now() - CRON_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const purgedLogs = await db.cronRun.deleteMany({
      where: { createdAt: { lt: cronCutoff } },
    });
    cronLogsPurged = purgedLogs.count;
    await db.deadLetterEntry.deleteMany({
      where: { resolvedAt: { not: null }, createdAt: { lt: cronCutoff } },
    });
  } catch {
    // non-critical
  }

  jobs.housekeeping = {
    purgedFeedItems: purgedCount,
    viberRetried: viberRetry.retried,
    viberSucceeded: viberRetry.succeeded,
    purgedCronLogs: cronLogsPurged,
  };
  await logRunToDB({ job: "housekeeping", startedAt: runStart, finishedAt: new Date(), status: "ok", itemsProcessed: purgedCount + cronLogsPurged });

  // ── Job 4: Scheduled Automation Rules ──
  try {
    const rules = await db.automationRule.findMany({
      where: { status: "ACTIVE", schedule: { not: null } },
      take: 50,
    });

    let rulesRun = 0;
    let rulesFailed = 0;

    for (const rule of rules) {
      // Only process rules with daily schedule (matches this cron)
      const schedule = typeof rule.schedule === "string" ? rule.schedule.trim() : "";
      if (schedule !== "daily" && schedule !== "0 6 * * *" && schedule !== "cron.daily") continue;

      const execStart = new Date();
      const logs: Array<{ level: string; message: string }> = [];
      let hasError = false;

      try {
        const actions = Array.isArray(rule.actionJson) ? (rule.actionJson as Array<Record<string, string>>) : [];

        for (const action of actions) {
          if (action.type === "create_notification" && action.userId) {
            await db.notification.create({
              data: {
                userId: action.userId,
                type: "automation",
                title: action.title ?? `Automation: ${rule.name}`,
                body: action.body ?? "Scheduled automation executed.",
              },
            });
            logs.push({ level: "info", message: "Notification created." });
          }

          if (action.type === "mirror_to_viber" && isViberBridgeReady()) {
            await mirrorToViber({
              id: rule.id,
              channelSlug: action.channel ?? "ops-general",
              content: action.message ?? `🤖 Automation: ${rule.name}`,
              authorName: "Automation Engine",
              timestamp: new Date(),
            });
            logs.push({ level: "info", message: "Viber mirror sent." });
          }

          if (action.type === "write_audit_log") {
            logs.push({ level: "info", message: `Audit: ${action.action ?? "automation.run"}` });
          }
        }

        rulesRun++;
      } catch (err) {
        hasError = true;
        rulesFailed++;
        logs.push({ level: "error", message: err instanceof Error ? err.message : "Unknown error" });
      }

      // Log execution
      try {
        await db.automationExecution.create({
          data: {
            ruleId: rule.id,
            status: hasError ? "FAILED" : "SUCCESS",
            startedAt: execStart,
            finishedAt: new Date(),
            outputJson: logs,
          },
        });
      } catch {
        // non-critical
      }
    }

    jobs.automations = { rulesEvaluated: rules.length, rulesRun, rulesFailed };
    await logRunToDB({ job: "automations", startedAt: runStart, finishedAt: new Date(), status: rulesFailed > 0 ? "partial" : "ok", itemsProcessed: rulesRun });
  } catch (err) {
    if (!isDatabaseUnavailableError(err)) {
      jobs.automations = { error: err instanceof Error ? err.message : "Failed" };
      await logRunToDB({ job: "automations", startedAt: runStart, finishedAt: new Date(), status: "error", itemsProcessed: 0, errorSummary: "Failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: runStart.toISOString(),
    durationMs: Date.now() - runStart.getTime(),
    jobs,
  });
}
