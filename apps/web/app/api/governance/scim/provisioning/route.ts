import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

const provisionSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email(),
  name: z.string().trim().min(2).max(120),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.VIEWER),
});

function isScimEnabled() {
  return process.env.SCIM_ENABLED === "1";
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";

  if (!workspaceId) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "workspaceId is required.", status: 400 });
  }

  try {
    await requireWorkspaceRole(workspaceId, ["ADMIN"]);

    return apiSuccess(
      {
        configured: isScimEnabled(),
        mode: "scim",
        hint: isScimEnabled() ? "Provisioning enabled." : "Set SCIM_ENABLED=1 to enable provisioning.",
      },
      { requestId, status: isScimEnabled() ? 200 : 503 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "SCIM_STATUS_FAILED",
      message: error instanceof Error ? error.message : "Failed to read SCIM status.",
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  if (!isScimEnabled()) {
    return apiError({
      requestId,
      code: "SCIM_DISABLED",
      message: "SCIM provisioning is disabled.",
      status: 503,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError({ requestId, code: "INVALID_JSON", message: "Invalid JSON payload.", status: 400 });
  }

  const parsed = provisionSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      requestId,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      status: 400,
    });
  }

  try {
    await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN"]);

    const user = await db.user.upsert({
      where: { email: parsed.data.email },
      create: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: "scim-managed",
        pinHash: null,
      },
      update: {
        name: parsed.data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const member = await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        userId: user.id,
        role: parsed.data.role,
      },
      update: {
        role: parsed.data.role,
      },
    });

    return apiSuccess(
      {
        user,
        membership: {
          workspaceId: member.workspaceId,
          userId: member.userId,
          role: member.role,
        },
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "SCIM_PROVISION_FAILED",
      message: error instanceof Error ? error.message : "SCIM provisioning failed.",
      status: 500,
    });
  }
}
