"use client";

import { useEffect } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <GlassCard className="mx-auto max-w-xl space-y-4">
      <h1 className="kpi-font text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-[var(--text-muted)]">
        The dashboard could not complete that action. Retry or return to a
        stable route.
      </p>
      {error.digest ? (
        <p className="text-xs text-[var(--text-muted)] opacity-80">
          Error ID: {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={reset}>Retry</PrimaryButton>
        <PrimaryButton asChild className="bg-transparent text-[var(--text)] shadow-none ring-1 ring-[var(--border)] hover:bg-white/10">
          <Link href="/overview">Go to Overview</Link>
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}
