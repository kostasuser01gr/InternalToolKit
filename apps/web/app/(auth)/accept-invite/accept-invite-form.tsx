import { UserPlus } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AcceptInviteFormProps = {
  token: string;
  workspaceName: string;
  email: string;
  role: string;
  error?: string | undefined;
  requestId?: string | undefined;
};

export function AcceptInviteForm({
  token,
  workspaceName,
  email,
  role,
  error,
  requestId,
}: AcceptInviteFormProps) {
  return (
    <GlassCard className="space-y-6 p-6 md:p-8" data-testid="accept-invite-page">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[#9a6fff2b] text-[#9a6fff]">
          <UserPlus className="size-5" aria-hidden="true" />
        </div>
        <h1 className="kpi-font text-2xl font-semibold">Accept invite</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Join <span className="font-medium text-[var(--text)]">{workspaceName}</span> as <span className="font-medium text-[var(--text)]">{role}</span>.
        </p>
        <p className="text-xs text-[var(--text-muted)]">Invited email: {email}</p>
      </div>

      <form method="post" action="/api/session/accept-invite-form" className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
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
          <Label htmlFor="loginName">Login name</Label>
          <Input
            id="loginName"
            name="loginName"
            autoComplete="username"
            required
            minLength={2}
            maxLength={80}
            pattern="[A-Za-z0-9._-]+"
            placeholder="alex.ops"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin">4-digit PIN</Label>
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
        {requestId ? (
          <p className="text-xs text-[var(--text-muted)]">Request ID: {requestId}</p>
        ) : null}

        <PrimaryButton type="submit" className="w-full">
          Accept invite
        </PrimaryButton>
      </form>
    </GlassCard>
  );
}
