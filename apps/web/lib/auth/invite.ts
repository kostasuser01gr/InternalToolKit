import { Prisma, WorkspaceRole } from "@prisma/client";
import { hashSync } from "bcryptjs";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { appendSecurityEvent } from "@/lib/security-events";
import { generateOneTimeToken, hashOpaqueToken, normalizeEmail, normalizeLoginName } from "@/lib/auth/tokens";

type InviteResult =
  | {
      ok: true;
      token: string;
      expiresAt: Date;
      email: string;
      role: WorkspaceRole;
    }
  | {
      ok: false;
      message: string;
    };

type AcceptInviteResult =
  | {
      ok: true;
      userId: string;
      workspaceId: string;
      workspaceName: string;
      email: string;
    }
  | {
      ok: false;
      message: string;
    };

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export async function createWorkspaceInvite(input: {
  workspaceId: string;
  invitedByUserId: string;
  email: string;
  role: WorkspaceRole;
  requestId?: string;
  ipAddress?: string;
  deviceId?: string;
  route?: string;
}): Promise<InviteResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const token = generateOneTimeToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    await db.$transaction(async (tx) => {
      await tx.inviteToken.updateMany({
        where: {
          workspaceId: input.workspaceId,
          email: normalizedEmail,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.inviteToken.create({
        data: {
          workspaceId: input.workspaceId,
          invitedByUserId: input.invitedByUserId,
          email: normalizedEmail,
          role: input.role,
          tokenHash,
          expiresAt,
        },
      });
    });

    await appendSecurityEvent({
      event: "auth.invite_created",
      severity: "info",
      requestId: input.requestId,
      actorUserId: input.invitedByUserId,
      ipAddress: input.ipAddress,
      deviceId: input.deviceId,
      route: input.route,
      details: {
        workspaceId: input.workspaceId,
        email: normalizedEmail,
        role: input.role,
      },
    });

    return {
      ok: true,
      token,
      expiresAt,
      email: normalizedEmail,
      role: input.role,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate invite right now.",
    };
  }
}

export async function getInviteByToken(token: string) {
  const tokenHash = hashOpaqueToken(token);
  const invite = await db.inviteToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite) {
    return null;
  }

  return invite;
}

export async function acceptWorkspaceInvite(input: {
  token: string;
  name: string;
  loginName: string;
  pin: string;
  password: string;
  requestId?: string;
  ipAddress?: string;
  deviceId?: string;
  route?: string;
}): Promise<AcceptInviteResult> {
  const invite = await getInviteByToken(input.token);

  if (!invite) {
    return {
      ok: false,
      message: "Invite token is invalid or expired.",
    };
  }

  const normalizedLoginName = normalizeLoginName(input.loginName);

  try {
    const accepted = await db.$transaction(async (tx) => {
      const loginCollision = await tx.user.findFirst({
        where: {
          loginName: normalizedLoginName,
          email: {
            not: invite.email,
          },
        },
        select: { id: true },
      });

      if (loginCollision) {
        throw new Error("Login name is already in use.");
      }

      const user = await tx.user.upsert({
        where: {
          email: invite.email,
        },
        create: {
          email: invite.email,
          loginName: normalizedLoginName,
          name: input.name.trim(),
          pinHash: hashSync(input.pin, 12),
          passwordHash: hashSync(input.password, 12),
          roleGlobal: "USER",
        },
        update: {
          loginName: normalizedLoginName,
          name: input.name.trim(),
          pinHash: hashSync(input.pin, 12),
          passwordHash: hashSync(input.password, 12),
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id,
          },
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        },
        update: {
          role: invite.role,
        },
      });

      await tx.inviteToken.update({
        where: {
          id: invite.id,
        },
        data: {
          usedAt: new Date(),
          usedByUserId: user.id,
        },
      });

      return {
        user,
        workspaceId: invite.workspace.id,
        workspaceName: invite.workspace.name,
      };
    });

    await appendAuditLog({
      workspaceId: accepted.workspaceId,
      actorUserId: accepted.user.id,
      action: "admin.invite_accepted",
      entityType: "workspace_member",
      entityId: accepted.user.id,
      metaJson: {
        email: accepted.user.email,
        role: invite.role,
      },
      source: "api",
    });

    await appendSecurityEvent({
      event: "auth.invite_accepted",
      severity: "info",
      requestId: input.requestId,
      actorUserId: accepted.user.id,
      targetUserId: accepted.user.id,
      ipAddress: input.ipAddress,
      deviceId: input.deviceId,
      route: input.route,
      details: {
        workspaceId: accepted.workspaceId,
        workspaceName: accepted.workspaceName,
      },
    });

    return {
      ok: true,
      userId: accepted.user.id,
      workspaceId: accepted.workspaceId,
      workspaceName: accepted.workspaceName,
      email: accepted.user.email,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Email or login name is already in use.",
      };
    }

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to accept invite.",
    };
  }
}
