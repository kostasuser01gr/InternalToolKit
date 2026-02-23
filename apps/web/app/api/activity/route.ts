import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { listDemoEvents } from "@/lib/demo-events";
import { requireSession } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/security";
import { getDefaultWorkspaceForUser, getWorkspaceForUser } from "@/lib/workspace";

const createEventSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  action: z.string().trim().min(2).max(120),
  entityType: z.string().trim().min(2).max(80),
  entityId: z.string().trim().min(1).max(120),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const session = await requireSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  return Response.json({
    ok: true,
    events: listDemoEvents(200),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const session = await requireSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid event payload.",
      },
      { status: 400 },
    );
  }

  const workspaceMembership = parsed.data.workspaceId
    ? await getWorkspaceForUser(session.user.id, parsed.data.workspaceId)
    : await getDefaultWorkspaceForUser(session.user.id);

  if (!workspaceMembership || !workspaceMembership.workspace) {
    return Response.json(
      {
        ok: false,
        message: "No workspace access found for activity event.",
      },
      { status: 403 },
    );
  }

  await appendAuditLog({
    workspaceId: workspaceMembership.workspace.id,
    actorUserId: session.user.id,
    action: parsed.data.action,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    metaJson: JSON.parse(JSON.stringify(parsed.data.meta ?? {})),
    source: "api",
  });

  return Response.json({ ok: true });
}
