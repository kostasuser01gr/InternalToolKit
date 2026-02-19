import { appendAuditLog } from "@/lib/audit";
import { clearSession, requireSession } from "@/lib/auth/session";
import { getRequestId, logWebRequest, withObservabilityHeaders } from "@/lib/http-observability";
import { isSameOriginRequest } from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/logout";

  if (!isSameOriginRequest(request)) {
    const response = Response.json(
      { ok: false, message: "Cross-origin request blocked." },
      withObservabilityHeaders({ status: 403 }, requestId),
    );

    logWebRequest({
      event: "web.auth.logout",
      requestId,
      route,
      method: request.method,
      status: 403,
      durationMs: Date.now() - startedAt,
    });

    return response;
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

  await clearSession("user_logout");
  const response = Response.json({ ok: true }, withObservabilityHeaders({ status: 200 }, requestId));

  logWebRequest({
    event: "web.auth.logout",
    requestId,
    route,
    method: request.method,
    status: 200,
    durationMs: Date.now() - startedAt,
    ...(session?.user?.id ? { userId: session.user.id } : {}),
  });

  return response;
}
