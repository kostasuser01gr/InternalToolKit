import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    requestId?: string;
    resetCode?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <GlassCard className="space-y-6 p-6 md:p-8" data-testid="forgot-password-page">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[#9a6fff2b] text-[#9a6fff]">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 className="kpi-font text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Enter your email and we will issue a one-time reset token.
        </p>
      </div>

      <form method="post" action="/api/session/request-password-reset-form" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="alex@internal.local"
          />
        </div>

        {params.error ? <p className="text-sm text-rose-300">{params.error}</p> : null}
        {params.success ? <p className="text-sm text-emerald-300">{params.success}</p> : null}
        {params.requestId ? (
          <p className="text-xs text-[var(--text-muted)]">Request ID: {params.requestId}</p>
        ) : null}

        <PrimaryButton type="submit" className="w-full">
          Send reset token
        </PrimaryButton>
      </form>

      {params.resetCode ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 text-xs text-[var(--text-muted)]">
          <p>Local dev reset token:</p>
          <p className="mt-1 break-all font-mono text-[var(--text)]">{params.resetCode}</p>
          <Link
            href={`/reset-password?code=${encodeURIComponent(params.resetCode)}`}
            className="mt-2 inline-block text-[#9a6fff] hover:underline"
          >
            Continue to reset form
          </Link>
        </div>
      ) : null}

      <p className="text-center text-sm text-[var(--text-muted)]">
        Back to{" "}
        <Link href="/login" className="font-medium text-[#9a6fff] hover:underline">
          Sign in
        </Link>
      </p>
    </GlassCard>
  );
}
