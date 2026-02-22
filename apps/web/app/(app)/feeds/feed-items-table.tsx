"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { VirtualTable, type VirtualTableColumn } from "@/components/kit/virtual-table";
import { Badge } from "@/components/ui/badge";

import { pinFeedItemAction, sendFeedToChatAction } from "./actions";

type FeedRow = {
  id: string;
  title: string;
  summary: string;
  url: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  relevanceScore: number;
  isPinned: boolean;
  sourceName: string;
  publishedAt: string;
  workspaceId: string;
};

type FeedItemsTableProps = {
  items: FeedRow[];
};

export function FeedItemsTable({ items }: FeedItemsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticItems, setOptimistic] = useOptimistic(
    items,
    (state, update: { id: string; isPinned: boolean }) =>
      state.map((i) => (i.id === update.id ? { ...i, isPinned: update.isPinned } : i)),
  );

  const handlePin = (item: FeedRow) => {
    startTransition(async () => {
      setOptimistic({ id: item.id, isPinned: !item.isPinned });
      const fd = new FormData();
      fd.set("itemId", item.id);
      fd.set("workspaceId", item.workspaceId);
      await pinFeedItemAction(fd);
      router.refresh();
    });
  };

  const handleShare = (item: FeedRow, channel: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("itemId", item.id);
      fd.set("workspaceId", item.workspaceId);
      fd.set("channel", channel);
      await sendFeedToChatAction(fd);
      router.refresh();
    });
  };

  const columns: VirtualTableColumn<FeedRow>[] = [
    {
      key: "pin",
      header: "",
      width: "30px",
      render: (r) => r.isPinned ? <span className="text-amber-400">📌</span> : null,
    },
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <div className="min-w-0">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--text)] hover:text-[var(--accent)] hover:underline line-clamp-1"
            onClick={(e) => e.stopPropagation()}
          >
            {r.title}
          </a>
          {r.summary ? (
            <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">{r.summary}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      width: "120px",
      render: (r) => (
        <Badge variant="default" className={r.categoryColor}>
          {r.categoryLabel}
        </Badge>
      ),
    },
    {
      key: "source",
      header: "Source",
      width: "100px",
      render: (r) => <span className="text-xs truncate">{r.sourceName}</span>,
    },
    {
      key: "score",
      header: "Score",
      width: "60px",
      render: (r) =>
        r.relevanceScore > 0 ? (
          <span className="text-xs text-[var(--accent)] tabular-nums">
            {(r.relevanceScore * 100).toFixed(0)}%
          </span>
        ) : <span className="text-xs text-[var(--text-muted)]">—</span>,
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      render: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleShare(r, "ops-general")}
            className="rounded border border-[var(--border)] bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-white/10"
          >
            💬
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleShare(r, "washers-only")}
            className="rounded border border-[var(--border)] bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-white/10"
          >
            🧽
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handlePin(r)}
            className="rounded border border-[var(--border)] bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-white/10"
          >
            {r.isPinned ? "Unpin" : "📌"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <VirtualTable
      data={optimisticItems}
      columns={columns}
      rowHeight={56}
      maxHeight={600}
      emptyMessage="No feed items yet. Add sources and scan to populate."
    />
  );
}
