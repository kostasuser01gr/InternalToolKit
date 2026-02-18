import { Prisma, type GlobalRole, WorkspaceRole } from "@prisma/client";
import { hashSync } from "bcryptjs";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security";

type SignupSuccess = {
  ok: true;
  user: {
    id: string;
    email: string;
    name: string;
    roleGlobal: GlobalRole;
  };
};

type SignupFailure = {
  ok: false;
  message: string;
  reason: "email_taken" | "unknown";
};

export type SignupResult = SignupSuccess | SignupFailure;

function createWorkspaceName(displayName: string) {
  return displayName.endsWith("s")
    ? `${displayName}' Workspace`
    : `${displayName}'s Workspace`;
}

export async function signupWithPassword(input: {
  name: string;
  email: string;
  password: string;
  ip?: string;
}): Promise<SignupResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim();
  const ip = input.ip ?? "unknown";

  try {
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedName,
          passwordHash: hashSync(input.password, 12),
        },
        select: {
          id: true,
          email: true,
          name: true,
          roleGlobal: true,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: createWorkspaceName(normalizedName),
          ownerId: user.id,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.ADMIN,
        },
      });

      return {
        user,
        workspaceId: workspace.id,
      };
    });

    try {
      await appendAuditLog({
        workspaceId: created.workspaceId,
        actorUserId: created.user.id,
        action: "auth.signup",
        entityType: "user",
        entityId: created.user.id,
        metaJson: {
          ip,
          email: created.user.email,
        },
        source: "api",
      });
    } catch (error) {
      logSecurityEvent("auth.signup_audit_failed", {
        userId: created.user.id,
        email: created.user.email,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    logSecurityEvent("auth.signup_success", {
      userId: created.user.id,
      email: created.user.email,
      ip,
    });

    return { ok: true, user: created.user };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      logSecurityEvent("auth.signup_failed", {
        reason: "email_taken",
        email: normalizedEmail,
        ip,
      });
      return {
        ok: false,
        reason: "email_taken",
        message: "An account with this email already exists.",
      };
    }

    logSecurityEvent("auth.signup_failed", {
      reason: "unexpected",
      email: normalizedEmail,
      ip,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      reason: "unknown",
      message: "Unable to create account right now. Please try again.",
    };
  }
}
