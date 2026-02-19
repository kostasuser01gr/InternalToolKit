import { hashSync } from "bcryptjs";

import { db } from "@/lib/db";
import { appendSecurityEvent } from "@/lib/security-events";
import { generateOneTimeToken, hashOpaqueToken, normalizeEmail } from "@/lib/auth/tokens";

const RESET_TTL_MS = 30 * 60 * 1000;

type PasswordResetRequestResult = {
  ok: true;
  tokenForDebug?: string;
};

type PasswordResetConsumeResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      message: string;
    };

function shouldExposeDebugToken() {
  return process.env.NODE_ENV !== "production";
}

export async function requestPasswordReset(input: {
  email: string;
  requestId?: string;
  ipAddress?: string;
  deviceId?: string;
  userAgent?: string;
  route?: string;
}): Promise<PasswordResetRequestResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const user = await db.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    await appendSecurityEvent({
      event: "auth.password_reset_requested_unknown_email",
      severity: "warn",
      requestId: input.requestId,
      ipAddress: input.ipAddress,
      deviceId: input.deviceId,
      route: input.route,
      details: {
        email: normalizedEmail,
      },
    });

    return { ok: true };
  }

  const token = generateOneTimeToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        requestedIp: input.ipAddress ?? null,
        requestedDeviceId: input.deviceId ?? null,
        requestedAgent: input.userAgent ?? null,
        expiresAt,
      },
    });
  });

  await appendSecurityEvent({
    event: "auth.password_reset_requested",
    severity: "info",
    requestId: input.requestId,
    actorUserId: user.id,
    targetUserId: user.id,
    ipAddress: input.ipAddress,
    deviceId: input.deviceId,
    route: input.route,
    details: {
      email: user.email,
    },
  });

  return {
    ok: true,
    ...(shouldExposeDebugToken() ? { tokenForDebug: token } : {}),
  };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
  requestId?: string;
  ipAddress?: string;
  deviceId?: string;
  route?: string;
}): Promise<PasswordResetConsumeResult> {
  const tokenHash = hashOpaqueToken(input.token);

  const token = await db.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!token) {
    return {
      ok: false,
      message: "Reset token is invalid or expired.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: token.userId,
      },
      data: {
        passwordHash: hashSync(input.password, 12),
      },
    });

    await tx.passwordResetToken.update({
      where: {
        id: token.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await tx.authSession.updateMany({
      where: {
        userId: token.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: "password_reset",
      },
    });
  });

  await appendSecurityEvent({
    event: "auth.password_reset_completed",
    severity: "info",
    requestId: input.requestId,
    actorUserId: token.user.id,
    targetUserId: token.user.id,
    ipAddress: input.ipAddress,
    deviceId: input.deviceId,
    route: input.route,
    details: {
      email: token.user.email,
    },
  });

  return {
    ok: true,
    userId: token.user.id,
  };
}

export async function getPasswordResetTokenMeta(token: string) {
  const tokenHash = hashOpaqueToken(token);
  return db.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });
}
