"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import {
  fetchFeedRaw,
  parseRssFeed,
  processFeedItems,
  hashUrl,
  DEFAULT_FEED_SOURCES,
} from "@/lib/feeds/scanner";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

export async function addFeedSourceAction(formData: FormData) {
  const workspaceId = formData.get("workspaceId") as string;
  const name = formData.get("name") as string;
  const url = formData.get("url") as string;

  if (!workspaceId || !name || !url) redirect("/feeds?error=Missing+required+fields");

  try {
    const { user } = await getAppContext(workspaceId);
    await db.feedSource.create({ data: { workspaceId, name, url, type: "rss" } });
    await appendAuditLog({
      workspaceId, action: "feeds.source_added", actorUserId: user.id,
      entityType: "feed", entityId: "new", metaJson: { name, url },
    });
    revalidatePath("/feeds");
    redirect("/feeds?success=Source+added");
  } catch (err) {
    rethrowIfRedirectError(err);
    if (isDatabaseUnavailableError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    redirect(`/feeds?error=${encodeURIComponent(err instanceof Error ? err.message : "Failed to add source")}`);
  }
}

export async function seedDefaultSourcesAction(formData: FormData) {
  const workspaceId = formData.get("workspaceId") as string;
  if (!workspaceId) redirect("/feeds?error=Missing+workspaceId");

  try {
    await getAppContext(workspaceId);
    for (const source of DEFAULT_FEED_SOURCES) {
      await db.feedSource.upsert({
        where: { id: `seed-${hashUrl(source.url)}` },
        update: {},
        create: {
          id: `seed-${hashUrl(source.url)}`, workspaceId,
          name: source.name, url: source.url, type: source.type,
        },
      });
    }
    revalidatePath("/feeds");
    redirect("/feeds?success=Default+sources+added");
  } catch (err) {
    rethrowIfRedirectError(err);
    if (isDatabaseUnavailableError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    redirect(`/feeds?error=${encodeURIComponent(err instanceof Error ? err.message : "Failed to seed sources")}`);
  }
}

export async function scanFeedSourceAction(formData: FormData) {
  const sourceId = formData.get("sourceId") as string;
  const workspaceId = formData.get("workspaceId") as string;
  if (!sourceId || !workspaceId) redirect("/feeds?error=Missing+fields");

  try {
    await getAppContext(workspaceId);
    const source = await db.feedSource.findUnique({ where: { id: sourceId }, select: { id: true, workspaceId: true, url: true, lastEtag: true, keywordsJson: true } });
    if (!source || source.workspaceId !== workspaceId) redirect("/feeds?error=Source+not+found");

    const { xml, etag, notModified } = await fetchFeedRaw(source.url, source.lastEtag);
    if (notModified) {
      await db.feedSource.update({ where: { id: sourceId }, data: { lastScannedAt: new Date() } });
      revalidatePath("/feeds");
      redirect("/feeds?success=No+new+items");
    }

    const rawItems = parseRssFeed(xml);
    const sourceKw = source.keywordsJson as { boost?: string[]; suppress?: string[] } | null;
    const scored = processFeedItems(rawItems, sourceKw);
    let newCount = 0;
    for (const item of scored) {
      const existing = await db.feedItem.findUnique({
        where: { workspaceId_urlHash: { workspaceId, urlHash: item.urlHash } },
      });
      if (!existing) {
        await db.feedItem.create({
          data: {
            workspaceId, sourceId, title: item.title, summary: item.summary ?? null,
            url: item.url, urlHash: item.urlHash, category: item.category,
            relevanceScore: item.relevanceScore, keywords: item.keywords.join(","),
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          },
        });
        newCount++;
      }
    }
    await db.feedSource.update({
      where: { id: sourceId },
      data: { lastScannedAt: new Date(), lastEtag: etag ?? null },
    });
    revalidatePath("/feeds");
    redirect(`/feeds?success=${newCount}+new+items`);
  } catch (error) {
    rethrowIfRedirectError(error);
    if (isDatabaseUnavailableError(error)) redirect("/feeds?error=Feeds+module+not+ready");
    
    const message = error instanceof Error ? error.message : "Fetch failed";
    redirect(`/feeds?error=${encodeURIComponent(message)}`);
  }
}

export async function pinFeedItemAction(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  const workspaceId = formData.get("workspaceId") as string;
  if (!itemId || !workspaceId) redirect("/feeds?error=Missing+fields");

  try {
    const { user } = await getAppContext(workspaceId);
    const item = await db.feedItem.findUnique({ where: { id: itemId } });
    if (!item || item.workspaceId !== workspaceId) redirect("/feeds?error=Not+found");

    await db.feedItem.update({
      where: { id: itemId },
      data: { isPinned: !item.isPinned, pinnedBy: item.isPinned ? null : user.id },
    });
    await appendAuditLog({
      workspaceId, action: item.isPinned ? "feeds.item_unpinned" : "feeds.item_pinned",
      actorUserId: user.id, entityType: "feed_item", entityId: itemId,
      metaJson: { title: item.title },
    });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    throw err;
  }
  revalidatePath("/feeds");
}

export async function sendFeedToChatAction(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  const workspaceId = formData.get("workspaceId") as string;
  const targetChannel = (formData.get("channel") as string) || "ops-general";
  if (!itemId || !workspaceId) redirect("/feeds?error=Missing+fields");

  try {
    const { user } = await getAppContext(workspaceId);
    const item = await db.feedItem.findUnique({ where: { id: itemId } });
    if (!item || item.workspaceId !== workspaceId) redirect("/feeds?error=Not+found");

    // Find or create target channel
    let channel = await db.chatChannel.findFirst({
      where: { workspaceId, slug: targetChannel },
    });
    if (!channel) {
      channel = await db.chatChannel.create({
        data: {
          workspaceId,
          name: `#${targetChannel}`,
          slug: targetChannel,
          type: "PUBLIC",
          createdBy: user.id,
        },
      });
    }

    // Create thread + message in the channel
    const thread = await db.chatThread.create({
      data: {
        workspaceId,
        channelId: channel.id,
        title: `📰 ${item.title}`,
        createdBy: user.id,
      },
    });

    const summary = item.summary
      ? `${item.summary.slice(0, 300)}${item.summary.length > 300 ? "…" : ""}`
      : "No summary available.";

    await db.chatMessage.create({
      data: {
        threadId: thread.id,
        authorUserId: user.id,
        role: "USER",
        content: `**📰 ${item.title}**\n\n${summary}\n\n🔗 ${item.url}`,
      },
    });

    await appendAuditLog({
      workspaceId,
      action: "feeds.item_sent_to_chat",
      actorUserId: user.id,
      entityType: "feed_item",
      entityId: itemId,
      metaJson: { title: item.title, channelSlug: targetChannel },
    });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) redirect("/feeds?error=Chat+module+not+ready");
    throw err;
  }
  revalidatePath("/feeds");
  redirect(`/feeds?success=Sent+to+%23${targetChannel}`);
}

export async function deleteFeedSourceAction(formData: FormData) {
  const sourceId = formData.get("sourceId") as string;
  const workspaceId = formData.get("workspaceId") as string;
  if (!sourceId || !workspaceId) redirect("/feeds?error=Missing+fields");

  try {
    const { user } = await getAppContext(workspaceId);
    const source = await db.feedSource.findUnique({ where: { id: sourceId } });
    if (!source || source.workspaceId !== workspaceId) redirect("/feeds?error=Source+not+found");

    await db.feedItem.deleteMany({ where: { sourceId } });
    await db.feedSource.delete({ where: { id: sourceId } });

    await appendAuditLog({
      workspaceId,
      action: "feeds.source_deleted",
      actorUserId: user.id,
      entityType: "feed",
      entityId: sourceId,
      metaJson: { name: source.name },
    });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    throw err;
  }
  revalidatePath("/feeds");
  redirect("/feeds?success=Source+deleted");
}

export async function updateFeedSourceKeywordsAction(input: {
  workspaceId: string;
  sourceId: string;
  boostKeywords: string[];
  suppressKeywords: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await getAppContext(input.workspaceId);
    const source = await db.feedSource.findUnique({ where: { id: input.sourceId } });
    if (!source || source.workspaceId !== input.workspaceId) {
      return { ok: false, error: "Source not found" };
    }
    await db.feedSource.update({
      where: { id: input.sourceId },
      data: {
        keywordsJson: {
          boost: input.boostKeywords.filter(Boolean),
          suppress: input.suppressKeywords.filter(Boolean),
        },
      },
    });
    revalidatePath("/feeds");
    return { ok: true };
  } catch (err) {
    if (isDatabaseUnavailableError(err)) return { ok: false, error: "Feeds module not ready" };
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
