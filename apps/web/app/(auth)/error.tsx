"use client";

import { useEffect, useId } from "react";
import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { extractCorrelationIds } from "@/lib/error-correlation";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const localErrorId = useId();
  const correlation = extractCorrelationIds(error);
  const displayErrorId = correlation.errorId ?? localErrorId;
  const displayRequestId = correlation.requestId;

  useEffect(() => {
    console.error("[AuthError]", {
      errorId: displayErrorId,
      requestId: displayRequestId,
      message: error.message,
    });
  }, [error, displayErrorId, displayRequestId]);

  return (
    <GlassCard className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="kpi-font text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-[var(--text-muted)]">
        The authentication page could not load. This may be a temporary issue.
      </p>
      <p className="text-xs text-[var(--text-muted)] opacity-80">
        Error&nbsp;ID:&nbsp;<code className="select-all font-mono">{displayErrorId}</code>
      </p>
      {displayRequestId ? (
        <p className="text-xs text-[var(--text-muted)] opacity-80">
          Request&nbsp;ID:&nbsp;<code className="select-all font-mono">{displayRequestId}</code>
        </p>
      ) : null}
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
