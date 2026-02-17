import { appendAuditLog } from "@/lib/audit";
import { clearSession, requireSession } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const session = await requireSession();

  if (session?.user?.id) {
    const membership = await getDefaultWorkspaceForUser(session.user.id);
    if (membership) {
      await appendAuditLog({
        workspaceId: membership.workspaceId,
        actorUserId: session.user.id,
        action: "auth.logout",
        entityType: "session",
        entityId: session.user.id,
        metaJson: {},
        source: "api",
      });
    }
  }

  await clearSession();
  return Response.json({ ok: true });
}
