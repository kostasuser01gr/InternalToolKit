import { Lock } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  callbackUrl: string | undefined;
  error: string | undefined;
};

export function LoginForm({ callbackUrl, error }: LoginFormProps) {
  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/overview";

  return (
    <GlassCard className="space-y-6 p-6 md:p-8" data-testid="login-page">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[#9a6fff2b] text-[#9a6fff]">
          <Lock className="size-5" aria-hidden="true" />
        </div>
        <h1 className="kpi-font text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Access the internal programmable dashboard.
        </p>
      </div>

      <form
        method="post"
        action={`/api/session/login-form?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="admin@internal.local"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <PrimaryButton type="submit" className="w-full">
          Continue
        </PrimaryButton>
      </form>
    </GlassCard>
  );
}
