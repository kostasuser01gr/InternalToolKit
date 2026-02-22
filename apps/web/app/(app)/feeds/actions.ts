"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/app-context";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  fetchFeedRaw,
  parseRssFeed,
  processFeedItems,
  hashUrl,
  DEFAULT_FEED_SOURCES,
} from "@/lib/feeds/scanner";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

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
  } catch (err) {
    if (isSchemaNotReadyError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    throw err;
  }
  revalidatePath("/feeds");
  redirect("/feeds?success=Source+added");
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
  } catch (err) {
    if (isSchemaNotReadyError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    throw err;
  }
  revalidatePath("/feeds");
  redirect("/feeds?success=Default+sources+added");
}

export async function scanFeedSourceAction(formData: FormData) {
  const sourceId = formData.get("sourceId") as string;
  const workspaceId = formData.get("workspaceId") as string;
  if (!sourceId || !workspaceId) redirect("/feeds?error=Missing+fields");

  try {
    await getAppContext(workspaceId);
    const source = await db.feedSource.findUnique({ where: { id: sourceId } });
    if (!source || source.workspaceId !== workspaceId) redirect("/feeds?error=Source+not+found");

    const { xml, etag, notModified } = await fetchFeedRaw(source.url, source.lastEtag);
    if (notModified) {
      await db.feedSource.update({ where: { id: sourceId }, data: { lastScannedAt: new Date() } });
      revalidatePath("/feeds");
      redirect("/feeds?success=No+new+items");
    }

    const rawItems = parseRssFeed(xml);
    const scored = processFeedItems(rawItems);
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
  } catch (err) {
    if (isSchemaNotReadyError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    // redirect throws are re-thrown by Next.js — only catch non-redirect errors
    throw err;
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
    if (isSchemaNotReadyError(err)) redirect("/feeds?error=Feeds+module+not+ready");
    throw err;
  }
  revalidatePath("/feeds");
}
