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
  reason: "email_taken" | "login_taken" | "unknown";
};

export type SignupResult = SignupSuccess | SignupFailure;

function createWorkspaceName(displayName: string) {
  return displayName.endsWith("s")
    ? `${displayName}' Workspace`
    : `${displayName}'s Workspace`;
}

export async function signupWithPassword(input: {
  name: string;
  loginName: string;
  pin: string;
  email: string;
  password: string;
  ip?: string;
}): Promise<SignupResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim();
  const normalizedLoginName = input.loginName.trim().toLowerCase();
  const ip = input.ip ?? "unknown";

  try {
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          loginName: normalizedLoginName,
          name: normalizedName,
          passwordHash: hashSync(input.password, 12),
          pinHash: hashSync(input.pin, 12),
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
          loginName: normalizedLoginName,
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
      loginName: normalizedLoginName,
    });

    return { ok: true, user: created.user };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [];
      const hasLoginCollision = target.includes("loginName");

      const reason = hasLoginCollision ? "login_taken" : "email_taken";
      const message = hasLoginCollision
        ? "This login name is already in use."
        : "An account with this email already exists.";

      logSecurityEvent("auth.signup_failed", {
        reason,
        email: normalizedEmail,
        loginName: normalizedLoginName,
        ip,
      });
      return {
        ok: false,
        reason,
        message,
      };
    }

    logSecurityEvent("auth.signup_failed", {
      reason: "unexpected",
      email: normalizedEmail,
      loginName: normalizedLoginName,
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
