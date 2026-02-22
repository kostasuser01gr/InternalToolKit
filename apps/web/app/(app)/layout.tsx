import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";
import { getRoleShortcuts } from "@/app/(app)/settings/role-shortcuts-actions";

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

  const roleShortcuts = await getRoleShortcuts(membership.workspace.id);

  return (
    <AppShell
      workspaceName={membership.workspace.name}
      userName={session.user.name ?? "Operator"}
      userRole={membership.role}
      roleShortcuts={Object.keys(roleShortcuts).length > 0 ? roleShortcuts : undefined}
    >
      {children}
    </AppShell>
  );
}
