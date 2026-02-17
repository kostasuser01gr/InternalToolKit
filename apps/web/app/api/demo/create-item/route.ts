import { appendAuditLog } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const session = await requireSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const membership = await getDefaultWorkspaceForUser(session.user.id);

  if (!membership) {
    return Response.json(
      { ok: false, message: "No workspace membership found." },
      { status: 403 },
    );
  }

  const notification = await db.notification.create({
    data: {
      userId: session.user.id,
      type: "demo",
      title: "Demo item created",
      body: "A command-palette demo action created this event.",
    },
  });

  await appendAuditLog({
    workspaceId: membership.workspaceId,
    actorUserId: session.user.id,
    action: "demo.item_created",
    entityType: "notification",
    entityId: notification.id,
    metaJson: {
      type: "command_palette",
    },
    source: "api",
  });

  return Response.json({ ok: true, notificationId: notification.id });
}
