"use client";

import { useRef, useState } from "react";

import { requestAccessAction } from "@/app/(app)/settings/request-access-action";

type RequestAccessButtonProps = {
  feature: string;
  className?: string;
};

export function RequestAccessButton({
  feature,
  className = "",
}: RequestAccessButtonProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    await requestAccessAction(formData);
    setSent(true);
    setSubmitting(false);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
    }, 2000);
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
        ✓ Request sent to coordinator
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-200 transition-all hover:bg-purple-500/20 ${className}`}
      >
        🔑 Request Access
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <input type="hidden" name="feature" value={feature} />
      <input
        type="text"
        name="reason"
        placeholder="Reason (optional)"
        className="h-8 w-48 rounded-md border border-[var(--border)] bg-white/6 px-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/40"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-purple-500 disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        Cancel
      </button>
    </form>
  );
}
