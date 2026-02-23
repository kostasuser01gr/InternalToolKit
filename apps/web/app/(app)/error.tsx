"use client";

import { useEffect, useId } from "react";
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
  const localErrorId = useId();

  useEffect(() => {
    console.error("[AppError]", { errorId: error.digest ?? localErrorId, message: error.message });
  }, [error, localErrorId]);

  const isAuthError = error.message?.includes("Authentication") || error.message?.includes("session");
  const isDbError = error.message?.includes("database") || error.message?.includes("connect");
  const isSchemaError = error.message?.includes("does not exist") || error.message?.includes("P2021") || error.message?.includes("P2022");

  const displayId = error.digest ?? localErrorId;

  return (
    <GlassCard className="mx-auto max-w-xl space-y-4">
      <h1 className="kpi-font text-2xl font-semibold">
        {isSchemaError ? "Setup Required" : "Something went wrong"}
      </h1>
      <p className="text-sm text-[var(--text-muted)]">
        {isSchemaError
          ? "Database schema is not fully applied. Please run migrations or contact your administrator."
          : isAuthError
            ? "Your session may have expired. Please sign in again."
            : isDbError
              ? "A temporary service issue occurred. Please retry in a moment."
              : "The dashboard could not complete that action. Retry or return to a stable route."}
      </p>
      <p className="text-xs text-[var(--text-muted)] opacity-80">
        Error&nbsp;ID:&nbsp;<code className="select-all font-mono">{displayId}</code>
      </p>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={reset}>Retry</PrimaryButton>
        {isAuthError ? (
          <PrimaryButton asChild className="bg-transparent text-[var(--text)] shadow-none ring-1 ring-[var(--border)] hover:bg-white/10">
            <Link href="/login">Sign in</Link>
          </PrimaryButton>
        ) : null}
        <PrimaryButton asChild className="bg-transparent text-[var(--text)] shadow-none ring-1 ring-[var(--border)] hover:bg-white/10">
          <Link href="/overview">Go to Overview</Link>
        </PrimaryButton>
      </div>
    </GlassCard>
  );
}
