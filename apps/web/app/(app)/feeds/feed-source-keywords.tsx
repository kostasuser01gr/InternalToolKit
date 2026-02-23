"use client";

import { useState, useTransition } from "react";

import { PrimaryButton } from "@/components/kit/primary-button";

import { updateFeedSourceKeywordsAction } from "./actions";

type FeedSourceKeywordsProps = {
  workspaceId: string;
  sourceId: string;
  sourceName: string;
  initial: { boost: string[]; suppress: string[] };
};

export function FeedSourceKeywords({ workspaceId, sourceId, sourceName, initial }: FeedSourceKeywordsProps) {
  const [open, setOpen] = useState(false);
  const [boost, setBoost] = useState(initial.boost.join(", "));
  const [suppress, setSuppress] = useState(initial.suppress.join(", "));
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => {
    startTransition(async () => {
      try {
        const result = await updateFeedSourceKeywordsAction({
          workspaceId,
          sourceId,
          boostKeywords: boost.split(",").map((s) => s.trim()).filter(Boolean),
          suppressKeywords: suppress.split(",").map((s) => s.trim()).filter(Boolean),
        });
        setMsg(result.ok ? "Saved" : `Error: ${result.error}`);
      } catch {
        setMsg("Error: action failed");
      }
      setTimeout(() => setMsg(null), 3000);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-[var(--accent)] hover:underline"
      >
        Keywords
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-2">
      <p className="text-[10px] font-semibold text-[var(--text-muted)]">
        Keywords for {sourceName}
      </p>
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)]">
          Boost (comma-separated):
          <input
            value={boost}
            onChange={(e) => setBoost(e.target.value)}
            className="mt-0.5 block w-full rounded border border-[var(--border)] bg-white/5 px-2 py-1 text-xs text-[var(--text)]"
            placeholder="cancellation, deposit, insurance"
          />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">
          Suppress (comma-separated):
          <input
            value={suppress}
            onChange={(e) => setSuppress(e.target.value)}
            className="mt-0.5 block w-full rounded border border-[var(--border)] bg-white/5 px-2 py-1 text-xs text-[var(--text)]"
            placeholder="cookies, newsletter"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <PrimaryButton type="button" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </PrimaryButton>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-[var(--text-muted)]">
          Close
        </button>
        {msg ? <span className="text-[10px] text-emerald-400">{msg}</span> : null}
      </div>
    </div>
  );
}
