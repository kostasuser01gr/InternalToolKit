import { AuthThrottleDimension } from "@prisma/client";

import { db } from "@/lib/db";
import { appendSecurityEvent } from "@/lib/security-events";

type AuthThrottleKeys = {
  ip: string;
  account: string;
  device: string;
};

type AuthThrottleResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  blockedBy: AuthThrottleDimension[];
};

type AuthThrottleContext = {
  requestId?: string;
  route?: string;
  ipAddress?: string;
  deviceId?: string;
  targetUserId?: string;
  accountIdentifier?: string;
};

type DimensionPolicy = {
  limit: number;
  windowMs: number;
  lockoutMs: number;
};

const THROTTLE_POLICY: Record<AuthThrottleDimension, DimensionPolicy> = {
  [AuthThrottleDimension.IP]: {
    limit: 60,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 10 * 60 * 1000,
  },
  [AuthThrottleDimension.ACCOUNT]: {
    limit: 8,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 20 * 60 * 1000,
  },
  [AuthThrottleDimension.DEVICE]: {
    limit: 24,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 10 * 60 * 1000,
  },
};

function normalizeIdentifier(value: string | undefined, fallback: string) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
}

export function buildAuthThrottleKeys(input: {
  ipAddress?: string;
  deviceId?: string;
  accountIdentifier?: string;
}) {
  return {
    ip: normalizeIdentifier(input.ipAddress, "unknown-ip"),
    device: normalizeIdentifier(input.deviceId, "unknown-device"),
    account: normalizeIdentifier(input.accountIdentifier, "unknown-account"),
  } satisfies AuthThrottleKeys;
}

function toEntries(keys: AuthThrottleKeys) {
  return [
    { dimension: AuthThrottleDimension.IP, identifier: keys.ip },
    { dimension: AuthThrottleDimension.ACCOUNT, identifier: keys.account },
    { dimension: AuthThrottleDimension.DEVICE, identifier: keys.device },
  ] as const;
}

function nowDate() {
  return new Date();
}

function isUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "P2002";
}

function windowExpired(startedAt: Date, windowMs: number, now: Date) {
  return startedAt.getTime() + windowMs <= now.getTime();
}

export async function checkAuthThrottle(keys: AuthThrottleKeys): Promise<AuthThrottleResult> {
  // Fail-open: if Prisma/DB is unreachable, allow the attempt.
  // Auth verification itself is handled by Convex which is independent.
  if (!db) {
    return { allowed: true, retryAfterSeconds: 0, blockedBy: [] };
  }

  try {
    return await checkAuthThrottleInternal(keys);
  } catch {
    return { allowed: true, retryAfterSeconds: 0, blockedBy: [] };
  }
}

async function checkAuthThrottleInternal(keys: AuthThrottleKeys): Promise<AuthThrottleResult> {
  const now = nowDate();
  const entries = toEntries(keys);

  const checks = await Promise.all(
    entries.map(({ dimension, identifier }) =>
      db.authThrottle.findUnique({
        where: {
          dimension_identifier: {
            dimension,
            identifier,
          },
        },
      }),
    ),
  );

  const blockedBy: AuthThrottleDimension[] = [];
  let retryAfterMs = 0;

  checks.forEach((row, index) => {
    if (!row?.lockoutUntil) {
      return;
    }

    if (row.lockoutUntil.getTime() <= now.getTime()) {
      return;
    }

    const remainingMs = row.lockoutUntil.getTime() - now.getTime();
    retryAfterMs = Math.max(retryAfterMs, remainingMs);
    const entry = entries[index];
    if (entry) {
      blockedBy.push(entry.dimension);
    }
  });

  if (blockedBy.length === 0) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      blockedBy,
    };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    blockedBy,
  };
}

async function registerAttempt(
  keys: AuthThrottleKeys,
  mutate: "failure" | "success",
  context: AuthThrottleContext,
) {
  if (!db) return;

  try {
    await registerAttemptInternal(keys, mutate, context);
  } catch {
    // Fail-open: throttle recording is non-critical
  }
}

async function registerAttemptInternal(
  keys: AuthThrottleKeys,
  mutate: "failure" | "success",
  context: AuthThrottleContext,
) {
  const now = nowDate();
  const entries = toEntries(keys);

  await db.$transaction(async (tx) => {
    for (const { dimension, identifier } of entries) {
      const policy = THROTTLE_POLICY[dimension];
      const where = {
        dimension_identifier: {
          dimension,
          identifier,
        },
      } as const;

      let existing = await tx.authThrottle.findUnique({ where });

      if (!existing) {
        try {
          await tx.authThrottle.create({
            data: {
              dimension,
              identifier,
              windowStartedAt: now,
              attemptCount: mutate === "failure" ? 1 : 0,
              lastAttemptAt: now,
              lockoutUntil: null,
            },
          });
          continue;
        } catch (error) {
          // Parallel login attempts can race on the unique key.
          if (!isUniqueConstraintError(error)) {
            throw error;
          }
        }

        existing = await tx.authThrottle.findUnique({ where });
        if (!existing) {
          throw new Error(
            `Auth throttle row missing after unique conflict for ${dimension}:${identifier}.`,
          );
        }
      }

      const shouldResetWindow = windowExpired(
        existing.windowStartedAt,
        policy.windowMs,
        now,
      );

      if (mutate === "success") {
        await tx.authThrottle.update({
          where,
          data: {
            attemptCount: 0,
            windowStartedAt: shouldResetWindow ? now : existing.windowStartedAt,
            lockoutUntil: null,
            lastAttemptAt: now,
          },
        });
        continue;
      }

      const baseAttempts = shouldResetWindow ? 0 : existing.attemptCount;
      const nextAttempts = baseAttempts + 1;
      const shouldLock = nextAttempts > policy.limit;

      await tx.authThrottle.update({
        where,
        data: {
          attemptCount: nextAttempts,
          windowStartedAt: shouldResetWindow ? now : existing.windowStartedAt,
          lockoutUntil: shouldLock
            ? new Date(now.getTime() + policy.lockoutMs)
            : existing.lockoutUntil && existing.lockoutUntil > now
              ? existing.lockoutUntil
              : null,
          lastAttemptAt: now,
        },
      });
    }
  });

  if (mutate !== "failure") {
    return;
  }

  const locked = await checkAuthThrottleInternal(keys);
  if (!locked.allowed) {
    await appendSecurityEvent({
      event: "auth.lockout_triggered",
      severity: "warn",
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      deviceId: context.deviceId,
      targetUserId: context.targetUserId,
      route: context.route,
      details: {
        blockedBy: locked.blockedBy,
        retryAfterSeconds: locked.retryAfterSeconds,
        accountIdentifier: context.accountIdentifier,
      },
    });
  }
}

export async function registerAuthFailure(
  keys: AuthThrottleKeys,
  context: AuthThrottleContext,
) {
  await registerAttempt(keys, "failure", context);
}

export async function registerAuthSuccess(
  keys: AuthThrottleKeys,
  context: AuthThrottleContext,
) {
  await registerAttempt(keys, "success", context);
}
