import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";
import { getRoleShortcuts } from "@/app/(app)/settings/role-shortcuts-actions";

type ShellConversation = {
  id: string;
  title: string;
  isPinned: boolean;
};

type ShellChannel = {
  id: string;
  name: string;
};

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

async function getChatSidebarState(workspaceId: string): Promise<{
  conversations: ShellConversation[];
  channels: ShellChannel[];
}> {
  try {
    const [threads, channels] = await Promise.all([
      db.chatThread.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, title: true, isPinned: true, updatedAt: true },
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
        take: 16,
      }),
      db.chatChannel.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, name: true, isPinned: true },
        orderBy: [{ isPinned: "desc" }, { name: "asc" }],
        take: 12,
      }),
    ]);

    return {
      conversations: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        isPinned: thread.isPinned,
      })),
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
      })),
    };
  } catch {
    return {
      conversations: [],
      channels: [],
    };
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

  let membership: Awaited<ReturnType<typeof getDefaultWorkspaceForUser>>;
  try {
    membership = await getDefaultWorkspaceForUser(session.user.id);
  } catch {
    // First attempt failed (transient DB/Convex issue) — retry once before redirecting
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      membership = await getDefaultWorkspaceForUser(session.user.id);
    } catch {
      // Both attempts failed — redirect to login
      redirect("/login?error=schema");
    }
  }

  if (!membership || !membership.workspace) {
    redirect("/login");
  }

  const workspace = membership.workspace!;

  const [roleShortcuts, opsInboxCount, chatSidebarState] = await Promise.all([
    getRoleShortcuts(workspace.id),
    getOpsInboxCount(workspace.id),
    getChatSidebarState(workspace.id),
  ]);

  return (
    <AppShell
      workspaceName={workspace.name}
      userName={session.user.name ?? "Operator"}
      userRole={membership.role}
      roleShortcuts={Object.keys(roleShortcuts).length > 0 ? roleShortcuts : undefined}
      opsInboxCount={opsInboxCount}
      recentConversations={chatSidebarState.conversations}
      workspaceChannels={chatSidebarState.channels}
    >
      {children}
    </AppShell>
  );
}
