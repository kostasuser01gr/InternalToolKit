import { IncidentSeverity } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api-result";
import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { EVENT_CONTRACTS } from "@/lib/events/contracts";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspacePermission } from "@/lib/rbac";
import { escalateIncidentSchema } from "@/lib/validators/incidents";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const severityRank: IncidentSeverity[] = [
  IncidentSeverity.LOW,
  IncidentSeverity.MEDIUM,
  IncidentSeverity.HIGH,
  IncidentSeverity.CRITICAL,
];

function bumpSeverity(severity: IncidentSeverity) {
  const index = severityRank.indexOf(severity);
  if (index < 0 || index === severityRank.length - 1) return severity;
  return severityRank[index + 1] ?? severity;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = escalateIncidentSchema.safeParse({
    incidentId: id,
    ...(payload as Record<string, unknown>),
  });

  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    const { user } = await requireWorkspacePermission(parsed.data.workspaceId, "fleet", "write");

    const incident = await db.incident.findFirst({
      where: {
        id: parsed.data.incidentId,
        workspaceId: parsed.data.workspaceId,
      },
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        workspaceId: true,
      },
    });

    if (!incident) {
      return apiError({ requestId, code: "NOT_FOUND", message: "Incident not found.", status: 404 });
    }

    const policy = parsed.data.escalationPolicyId
      ? await db.escalationPolicy.findFirst({
          where: {
            id: parsed.data.escalationPolicyId,
            workspaceId: parsed.data.workspaceId,
            module: "incidents",
            isActive: true,
          },
        })
      : await db.escalationPolicy.findFirst({
          where: {
            workspaceId: parsed.data.workspaceId,
            module: "incidents",
            isActive: true,
          },
          orderBy: { updatedAt: "desc" },
        });

    const nextSeverity = bumpSeverity(incident.severity);

    const updatedIncident = await db.incident.update({
      where: { id: incident.id },
      data: {
        severity: nextSeverity,
        status: incident.status === "OPEN" ? "INVESTIGATING" : incident.status,
      },
      select: {
        id: true,
        severity: true,
        status: true,
        title: true,
      },
    });

    const recipients = await db.workspaceMember.findMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        role: { in: ["ADMIN", "EDITOR"] },
      },
      select: { userId: true },
      take: 25,
    });

    await db.notification.createMany({
      data: recipients.map((member) => ({
        userId: member.userId,
        type: "INCIDENT_ESCALATED",
        title: `Incident escalated: ${updatedIncident.title.slice(0, 70)}`,
        body: parsed.data.reason ?? "Escalation requested due to SLA risk.",
      })),
      skipDuplicates: true,
    });

    await appendAuditLog({
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      action: "incident.escalated",
      entityType: "incident",
      entityId: incident.id,
      metaJson: {
        oldSeverity: incident.severity,
        newSeverity: updatedIncident.severity,
        reason: parsed.data.reason ?? null,
        escalationPolicyId: policy?.id ?? null,
      },
      source: "api",
    });

    return apiSuccess(
      {
        incident: updatedIncident,
        escalationPolicy: policy
          ? {
              id: policy.id,
              name: policy.name,
              module: policy.module,
            }
          : null,
        event: EVENT_CONTRACTS.find((event) => event === "incident.escalated"),
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Incident escalation failed.";
    return apiError({ requestId, code: "INCIDENT_ESCALATION_FAILED", message, status: 500 });
  }
}
