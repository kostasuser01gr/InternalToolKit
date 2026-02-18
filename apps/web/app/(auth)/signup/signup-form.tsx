import Link from "next/link";
import { UserPlus } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignupFormProps = {
  callbackUrl: string | undefined;
  error: string | undefined;
};

export function SignupForm({ callbackUrl, error }: SignupFormProps) {
  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/overview";

  return (
    <GlassCard className="space-y-6 p-6 md:p-8" data-testid="signup-page">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[#9a6fff2b] text-[#9a6fff]">
          <UserPlus className="size-5" aria-hidden="true" />
        </div>
        <h1 className="kpi-font text-2xl font-semibold">Create account</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Create your workspace and start using the dashboard.
        </p>
      </div>

      <form
        method="post"
        action={`/api/session/signup-form?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Alex Operator"
          />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
            placeholder="At least 8 characters"
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
            placeholder="Repeat your password"
          />
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <PrimaryButton type="submit" className="w-full">
          Create account
        </PrimaryButton>
      </form>

      <p className="text-center text-sm text-[var(--text-muted)]">
        Already have an account?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
          className="font-medium text-[#9a6fff] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </GlassCard>
  );
}
