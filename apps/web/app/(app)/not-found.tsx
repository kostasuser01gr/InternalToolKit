import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";

export default function AppNotFound() {
  return (
    <GlassCard className="mx-auto max-w-xl space-y-3">
      <h1 className="kpi-font text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-[var(--text-muted)]">
        The requested internal tool route was not found.
      </p>
      <Link
        href="/overview"
        className="focus-ring inline-flex rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
      >
        Return to overview
      </Link>
    </GlassCard>
  );
}
