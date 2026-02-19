import { redirect } from "next/navigation";

import { GlassCard } from "@/components/kit/glass-card";
import { requireSession } from "@/lib/auth/session";
import { getInviteByToken } from "@/lib/auth/invite";

import { AcceptInviteForm } from "./accept-invite-form";

type AcceptInvitePageProps = {
  searchParams: Promise<{
    code?: string;
    error?: string;
    requestId?: string;
  }>;
};

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const params = await searchParams;
  const session = await requireSession();

  if (session?.user?.id) {
    redirect("/overview");
  }

  const code = params.code?.trim();

  if (!code) {
    return (
      <GlassCard className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Invite code missing</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Use the invite link provided by your workspace admin.
        </p>
      </GlassCard>
    );
  }

  const invite = await getInviteByToken(code);

  if (!invite) {
    return (
      <GlassCard className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Invite expired</h1>
        <p className="text-sm text-[var(--text-muted)]">
          This invite is invalid or already used. Ask your admin to generate a new invite.
        </p>
      </GlassCard>
    );
  }

  return (
    <AcceptInviteForm
      token={code}
      workspaceName={invite.workspace.name}
      email={invite.email}
      role={invite.role}
      error={params.error}
      requestId={params.requestId}
    />
  );
}
