import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

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

  return (
    <AppShell
      workspaceName={membership.workspace.name}
      userName={session.user.name ?? "Operator"}
    >
      {children}
    </AppShell>
  );
}
