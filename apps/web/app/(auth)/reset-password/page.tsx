import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPasswordResetTokenMeta } from "@/lib/auth/password-reset";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    code?: string;
    error?: string;
    requestId?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const code = params.code?.trim();

  if (!code) {
    return (
      <GlassCard className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Reset code missing</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Use a valid one-time reset link or request a new reset token.
        </p>
        <Link href="/forgot-password" className="text-sm text-[#9a6fff] hover:underline">
          Request new token
        </Link>
      </GlassCard>
    );
  }

  const token = await getPasswordResetTokenMeta(code);

  if (!token) {
    return (
      <GlassCard className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Reset token expired</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This token is invalid or already used. Request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm text-[#9a6fff] hover:underline">
          Request new token
        </Link>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="space-y-6 p-6 md:p-8" data-testid="reset-password-page">
      <div className="space-y-2 text-center">
        <h1 className="kpi-font text-2xl font-semibold">Create new password</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Resetting account for <span className="font-medium text-[var(--text)]">{token.user.email}</span>
        </p>
      </div>

      <form method="post" action="/api/session/reset-password-form" className="space-y-4">
        <input type="hidden" name="token" value={code} />

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
          />
        </div>

        {params.error ? <p className="text-sm text-rose-300">{params.error}</p> : null}
        {params.requestId ? (
          <p className="text-xs text-[var(--text-muted)]">Request ID: {params.requestId}</p>
        ) : null}

        <PrimaryButton type="submit" className="w-full">
          Reset password
        </PrimaryButton>
      </form>
    </GlassCard>
  );
}
