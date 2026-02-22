import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";
import { getRoleShortcuts } from "@/app/(app)/settings/role-shortcuts-actions";

async function getOpsInboxCount(workspaceId: string): Promise<number> {
  try {
    const [feedCount, shiftReqCount, incidentCount] = await Promise.all([
      db.feedItem.count({ where: { workspaceId, relevanceScore: { gte: 0.6 } } }).catch(() => 0),
      db.shiftRequest.count({ where: { workspaceId, status: "PENDING" } }).catch(() => 0),
      db.incident.count({ where: { workspaceId, resolvedAt: null } }).catch(() => 0),
    ]);
    return feedCount + shiftReqCount + incidentCount;
  } catch {
    return 0;
  }
}

export default async function MainAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getDefaultWorkspaceForUser(session.user.id);

  if (!membership) {
    redirect("/login");
  }

  const [roleShortcuts, opsInboxCount] = await Promise.all([
    getRoleShortcuts(membership.workspace.id),
    getOpsInboxCount(membership.workspace.id),
  ]);

  return (
    <AppShell
      workspaceName={membership.workspace.name}
      userName={session.user.name ?? "Operator"}
      userRole={membership.role}
      roleShortcuts={Object.keys(roleShortcuts).length > 0 ? roleShortcuts : undefined}
      opsInboxCount={opsInboxCount}
    >
      {children}
    </AppShell>
  );
}
