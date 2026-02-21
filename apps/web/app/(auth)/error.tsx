"use client";

import { useEffect } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";

export default function AuthError({
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
    <GlassCard className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="kpi-font text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-[var(--text-muted)]">
        The authentication page could not load. This may be a temporary issue.
      </p>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={reset}>Retry</PrimaryButton>
        <PrimaryButton
          asChild
          className="bg-transparent text-[var(--text)] shadow-none ring-1 ring-[var(--border)] hover:bg-white/10"
        >
          <Link href="/login">Go to Login</Link>
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}
