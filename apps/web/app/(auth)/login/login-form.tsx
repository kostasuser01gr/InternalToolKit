import Link from "next/link";
import { Lock } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  callbackUrl: string | undefined;
  error: string | undefined;
  requestId?: string | undefined;
  errorId?: string | undefined;
};

export function LoginForm({ callbackUrl, error, requestId, errorId }: LoginFormProps) {
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
          Access the internal programmable dashboard with login name + PIN or
          email + password.
        </p>
      </div>

      <form
        method="post"
        action={`/api/session/login-form?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
        className="space-y-4"
      >
        <input type="hidden" name="method" value="pin" />
        <div className="space-y-2">
          <Label htmlFor="loginName">Login name</Label>
          <Input
            id="loginName"
            name="loginName"
            autoComplete="username"
            required
            placeholder="admin"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            name="pin"
            type="password"
            autoComplete="one-time-code"
            required
            inputMode="numeric"
            pattern="\d{4}"
            minLength={4}
            maxLength={4}
            placeholder="1234"
          />
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {errorId ? (
          <p className="text-xs text-[var(--text-muted)]">Error ID: {errorId}</p>
        ) : null}
        {requestId ? (
          <p className="text-xs text-[var(--text-muted)]">Request ID: {requestId}</p>
        ) : null}

        <PrimaryButton type="submit" className="w-full">
          Continue
        </PrimaryButton>
      </form>

      <form
        method="post"
        action={`/api/session/login-form?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
        className="space-y-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4"
      >
        <input type="hidden" name="method" value="password" />
        <p className="text-xs text-[var(--text-muted)]">
          Compatibility login
        </p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@company.com"
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
            minLength={8}
            placeholder="Your account password"
          />
        </div>

        <PrimaryButton type="submit" className="w-full">
          Continue with password
        </PrimaryButton>
      </form>

      <p className="text-center text-sm text-[var(--text-muted)]">
        New here?{" "}
        <Link
          href={`/signup?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`}
          className="font-medium text-[#9a6fff] hover:underline"
        >
          Create account
        </Link>
      </p>

      <p className="text-center text-sm text-[var(--text-muted)]">
        Forgot password?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-[#9a6fff] hover:underline"
        >
          Reset it
        </Link>
      </p>
    </GlassCard>
  );
}
