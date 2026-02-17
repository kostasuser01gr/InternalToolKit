"use client";

import { useEffect } from "react";

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
      <PrimaryButton onClick={reset}>Retry</PrimaryButton>
    </GlassCard>
  );
}
