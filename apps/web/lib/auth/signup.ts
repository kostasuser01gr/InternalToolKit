import { Prisma, type GlobalRole, WorkspaceRole } from "@prisma/client";
import { hashSync } from "bcryptjs";

import { appendAuditLog } from "@/lib/audit";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/lib/convex-api";
import { isDatabaseConnectivityError } from "@/lib/db-failover";
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

function resolveOperationalSignupMessage(error: unknown) {
  if (isDatabaseConnectivityError(error)) {
    return "Signup is temporarily unavailable because database connectivity is invalid. Check /api/health and verify Supabase pooler/direct DATABASE_URL values with sslmode before redeploying.";
  }

  if (!(error instanceof Error)) {
    return null;
  }

  if (
    /(table .* does not exist|relation .* does not exist|column .* does not exist|p2021|p2022)/i.test(
      error.message,
    )
  ) {
    return "Signup is temporarily unavailable because the database schema is not ready. Run db:migrate:deploy and try again.";
  }

  return null;
}

export async function signupWithPassword(input: {
  name: string;
  loginName: string;
  pin: string;
  email: string;
  password: string;
  ip?: string;
  requestId?: string;
}): Promise<SignupResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim();
  const normalizedLoginName = input.loginName.trim().toLowerCase();
  const normalizedPassword = input.password.trim();
  const normalizedPin = input.pin.trim();
  const ip = input.ip ?? "unknown";

  try {
    const convex = getConvexClient();

    let created: { user: { id: string; email: string; name: string; roleGlobal: GlobalRole }; workspaceId: string };

    if (convex) {
      // ── Convex path: signup action hashes passwords and creates user+workspace atomically ──
      const result = await convex.action(api.authActions.signup, {
        email: normalizedEmail,
        loginName: normalizedLoginName,
        name: normalizedName,
        password: normalizedPassword,
        pin: normalizedPin,
        workspaceName: createWorkspaceName(normalizedName),
      });
      created = {
        user: {
          id: result.userId,
          email: normalizedEmail,
          name: normalizedName,
          roleGlobal: "USER" as GlobalRole,
        },
        workspaceId: result.workspaceId,
      };
    } else {
      // ── Prisma fallback ──
      created = await db.$transaction(async (tx: any) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            loginName: normalizedLoginName,
            name: normalizedName,
            passwordHash: hashSync(normalizedPassword, 12),
            pinHash: hashSync(normalizedPin, 12),
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
    }

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
        requestId: input.requestId,
      });
      return {
        ok: false,
        reason,
        message,
      };
    }

    const operationalMessage = resolveOperationalSignupMessage(error);

    logSecurityEvent("auth.signup_failed", {
      reason: "unexpected",
      email: normalizedEmail,
      loginName: normalizedLoginName,
      ip,
      requestId: input.requestId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      reason: "unknown",
      message:
        operationalMessage ??
        "Unable to create account right now. Please try again.",
    };
  }
}
