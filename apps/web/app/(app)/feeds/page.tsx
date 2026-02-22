import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

import {
  addFeedSourceAction,
  deleteFeedSourceAction,
  scanFeedSourceAction,
  seedDefaultSourcesAction,
} from "./actions";
import { FeedItemsTable } from "./feed-items-table";
import { FeedSourceKeywords } from "./feed-source-keywords";

type FeedsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    category?: string;
  }>;
};

function parseKeywords(json: unknown): { boost: string[]; suppress: string[] } {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const obj = json as Record<string, unknown>;
    return {
      boost: Array.isArray(obj["boost"]) ? (obj["boost"] as string[]) : [],
      suppress: Array.isArray(obj["suppress"]) ? (obj["suppress"] as string[]) : [],
    };
  }
  return { boost: [], suppress: [] };
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  BOOKING_POLICY: { label: "Booking Policy", color: "text-blue-300 bg-blue-400/20 border-blue-400/40" },
  COMPETITOR_NEWS: { label: "Competitor", color: "text-purple-300 bg-purple-400/20 border-purple-400/40" },
  SALES_OPPORTUNITY: { label: "Sales", color: "text-emerald-300 bg-emerald-400/20 border-emerald-400/40" },
  SECURITY_ALERT: { label: "Security", color: "text-rose-300 bg-rose-400/20 border-rose-400/40" },
  GENERAL: { label: "General", color: "text-gray-300 bg-gray-400/20 border-gray-400/40" },
};

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext();

  let sources: { id: string; name: string; url: string; lastScannedAt: Date | null; keywordsJson: unknown; _count: { items: number } }[] = [];
  let items: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    category: string;
    relevanceScore: number;
    isPinned: boolean;
    publishedAt: Date | null;
    fetchedAt: Date;
    source: { name: string };
  }[] = [];

  try {
    [sources, items] = await Promise.all([
      db.feedSource.findMany({
        where: { workspaceId: workspace.id },
        include: { _count: { select: { items: true } } },
        orderBy: { name: "asc" },
      }),
      db.feedItem.findMany({
        where: {
          workspaceId: workspace.id,
          ...(params.category ? { category: params.category as "BOOKING_POLICY" | "COMPETITOR_NEWS" | "SALES_OPPORTUNITY" | "SECURITY_ALERT" | "GENERAL" } : {}),
        },
        include: { source: { select: { name: true } } },
        orderBy: [{ isPinned: "desc" }, { fetchedAt: "desc" }],
        take: 100,
      }),
    ]);
  } catch (err) {
    if (!isSchemaNotReadyError(err)) throw err;
  }

  const categories = Object.entries(CATEGORY_LABELS);

  return (
    <div className="space-y-6" data-testid="feeds-page">
      <PageHeader
        title="Feeds & Intelligence"
        subtitle="Booking policies, competitor news, sales opportunities, and security alerts — auto-scanned."
      />

      <StatusBanner error={params.error} success={params.success} />

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/feeds"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
            !params.category
              ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5"
          }`}
        >
          All ({items.length})
        </Link>
        {categories.map(([key, meta]) => (
          <Link
            key={key}
            href={`/feeds?category=${key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              params.category === key ? meta.color : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5"
            }`}
          >
            {meta.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px,1fr]">
        {/* Sources Sidebar */}
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-lg font-semibold">Feed Sources</h2>

          {sources.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-muted)]">No sources configured.</p>
              <form action={seedDefaultSourcesAction}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <PrimaryButton type="submit" className="w-full">
                  Add Default Sources
                </PrimaryButton>
              </form>
            </div>
          )}

          {sources.map((src) => (
            <div key={src.id} className="rounded border border-[var(--border)] bg-white/5 p-2 text-sm">
              <p className="font-medium text-[var(--text)] truncate">{src.name}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{src.url}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{src._count.items} items</span>
                <div className="flex gap-2">
                  <form action={deleteFeedSourceAction}>
                    <input type="hidden" name="sourceId" value={src.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button type="submit" className="text-rose-400 hover:underline">
                      Delete
                    </button>
                  </form>
                  <form action={scanFeedSourceAction}>
                    <input type="hidden" name="sourceId" value={src.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button type="submit" className="text-[var(--accent)] hover:underline">
                      Scan Now
                    </button>
                  </form>
                </div>
              </div>
              <FeedSourceKeywords
                workspaceId={workspace.id}
                sourceId={src.id}
                sourceName={src.name}
                initial={parseKeywords(src.keywordsJson)}
              />
            </div>
          ))}

          {/* Add Source Form */}
          <form action={addFeedSourceAction} className="space-y-2 border-t border-[var(--border)] pt-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <Label htmlFor="feed-name">Source Name</Label>
            <Input id="feed-name" name="name" placeholder="Industry News" required />
            <Label htmlFor="feed-url">RSS URL</Label>
            <Input id="feed-url" name="url" placeholder="https://..." required />
            <PrimaryButton type="submit" className="w-full">
              Add Source
            </PrimaryButton>
          </form>
        </GlassCard>

        {/* Feed Items */}
        <div className="space-y-3">
          <FeedItemsTable
            items={items.map((item) => {
              const catMeta = CATEGORY_LABELS[item.category] ?? CATEGORY_LABELS["GENERAL"]!;
              return {
                id: item.id,
                title: item.title,
                summary: item.summary ?? "",
                url: item.url,
                category: item.category,
                categoryLabel: catMeta.label,
                categoryColor: catMeta.color,
                relevanceScore: item.relevanceScore,
                isPinned: item.isPinned,
                sourceName: item.source.name,
                publishedAt: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "",
                workspaceId: workspace.id,
              };
            })}
          />
        </div>
      </div>
    </div>
  );
}
