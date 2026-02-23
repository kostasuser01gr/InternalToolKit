import { compareSync } from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { AuthAdapter } from "@/lib/auth/adapter";
import type { AuthCredentials } from "@/lib/auth/adapter";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SAME_SITE,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import { generateOneTimeToken, hashOpaqueToken, normalizeEmail, normalizeLoginName } from "@/lib/auth/tokens";
import { getServerEnv } from "@/lib/env";
import type { AppSession, SessionUser } from "@/lib/auth/types";
import type { GlobalRole } from "@prisma/client";
import type { Id } from "@convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/lib/convex-api";
import { logSecurityEvent } from "@/lib/security";
import { db } from "@/lib/db";

type SessionPayload = {
  uid: string;
  sid: string;
  st: string;
  iat: number;
  exp: number;
};

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function getSessionSecret() {
  return getServerEnv().SESSION_SECRET;
}

function sign(body: string) {
  return createHmac("sha256", getSessionSecret()).update(body).digest();
}

function encodeToken(payload: SessionPayload) {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(sign(body));
  return `${body}.${signature}`;
}

function decodeToken(token: string): SessionPayload | null {
  const [body, signature, extra] = token.split(".");

  if (!body || !signature || extra) {
    return null;
  }

  let expected: Buffer;
  try {
    expected = sign(body);
  } catch {
    // Runtime env may be missing/invalid; treat token as unusable instead of crashing.
    return null;
  }
  const actual = fromBase64Url(signature);

  if (actual.length !== expected.length) {
    return null;
  }

  if (!timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(body).toString("utf8")) as SessionPayload;

    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.sid !== "string" ||
      typeof parsed.st !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    if (parsed.exp * 1000 <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function getSessionPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return decodeToken(token);
}

async function setSessionCookie(payload: SessionPayload) {
  const token = encodeToken(payload);

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: SESSION_COOKIE_SECURE,
    path: "/",
    expires: new Date(payload.exp * 1000),
  });
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: SESSION_COOKIE_SECURE,
    path: "/",
    expires: new Date(0),
  });
}

function tokenHashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isPinCredentials(input: AuthCredentials): input is {
  method?: "pin";
  loginName: string;
  pin: string;
  ip?: string;
  deviceId?: string;
  requestId?: string;
  userAgent?: string;
} {
  return "loginName" in input && "pin" in input;
}

async function resolveSession(payload: SessionPayload): Promise<AppSession | null> {
  try {
    const convex = getConvexClient();

    if (convex) {
      // ── Convex path ──
      const result = await convex.query(api.auth.resolveSession, {
        sessionId: payload.sid as Id<"authSessions">,
        userId: payload.uid as Id<"users">,
      });
      if (!result) return null;

      if (!tokenHashesMatch(result.session.tokenHash, hashOpaqueToken(payload.st))) {
        return null;
      }

      // Touch session if stale (> 30s)
      const nowMs = Date.now();
      const lastSeenMs = result.session.lastSeenAt ?? 0;
      if (nowMs - lastSeenMs >= 30_000) {
        void convex.mutation(api.auth.touch, { id: payload.sid as Id<"authSessions"> }).catch(() => {});
      }

      return {
        user: {
          id: result.user._id,
          email: result.user.email,
          name: result.user.name,
          roleGlobal: result.user.roleGlobal as GlobalRole,
        },
        session: {
          id: result.session._id,
          createdAt: new Date(result.session._creationTime),
          lastSeenAt: new Date(nowMs - lastSeenMs >= 30_000 ? nowMs : lastSeenMs),
          expiresAt: new Date(result.session.expiresAt),
          elevatedUntil: result.session.elevatedUntil ? new Date(result.session.elevatedUntil) : null,
        },
      };
    }

    // ── Prisma fallback ──
    if (!db) return null;
    const now = new Date();
    const record = await db.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.uid,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            roleGlobal: true,
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    if (!tokenHashesMatch(record.tokenHash, hashOpaqueToken(payload.st))) {
      return null;
    }

    const nowMs = Date.now();
    const lastSeenMs = record.lastSeenAt.getTime();
    if (nowMs - lastSeenMs >= 30_000) {
      await db.authSession.update({
        where: { id: record.id },
        data: {
          lastSeenAt: new Date(nowMs),
        },
      });
    }

    return {
      user: {
        id: record.user.id,
        email: record.user.email,
        name: record.user.name,
        roleGlobal: record.user.roleGlobal,
      },
      session: {
        id: record.id,
        createdAt: record.createdAt,
        lastSeenAt: new Date(nowMs - lastSeenMs >= 30_000 ? nowMs : record.lastSeenAt.getTime()),
        expiresAt: record.expiresAt,
        elevatedUntil: record.elevatedUntil,
      },
    };
  } catch (error) {
    logSecurityEvent("auth.session_lookup_failed", {
      reason: "session_lookup_failed",
      message: error instanceof Error ? error.message : "unknown",
      userId: payload.uid,
      sessionId: payload.sid,
    });
    return null;
  }
}

export const cookieAuthAdapter: AuthAdapter = {
  async signInWithCredentials(input) {
    const ip = input.ip ?? "unknown";
    const mode = isPinCredentials(input) ? "pin" : "password";
    const identifier = isPinCredentials(input)
      ? normalizeLoginName(input.loginName)
      : normalizeEmail(input.email);

    const convex = getConvexClient();

    if (convex) {
      // ── Convex path: bcrypt runs in Convex action ──
      const verifyArgs = isPinCredentials(input)
        ? { loginName: normalizeLoginName(input.loginName), pin: input.pin }
        : { email: normalizeEmail(input.email), password: input.password };
      const result = await convex.action(api.authActions.verifyCredentials, verifyArgs);

      if (!result.ok || !result.user) {
        logSecurityEvent("auth.login_failed", {
          reason: "bad_credentials",
          mode,
          identifier,
          ip,
        });
        return { ok: false, message: result.message ?? "Invalid credentials." };
      }

      logSecurityEvent("auth.login_success", {
        userId: result.user.id,
        email: result.user.email,
        mode,
        ip,
      });

      return { ok: true, user: { ...result.user, roleGlobal: result.user.roleGlobal as GlobalRole } };
    }

    // ── Prisma fallback ──
    if (!db) return { ok: false, message: "Database not configured." };

    const user = isPinCredentials(input)
      ? await db.user.findUnique({
          where: { loginName: normalizeLoginName(input.loginName) },
        })
      : await db.user.findUnique({
          where: { email: normalizeEmail(input.email) },
        });

    if (!user) {
      logSecurityEvent("auth.login_failed", {
        reason: "bad_credentials",
        mode,
        identifier,
        ip,
      });
      return { ok: false, message: "Invalid credentials." };
    }

    const validCredentials = isPinCredentials(input)
      ? Boolean(user.pinHash) && compareSync(input.pin, user.pinHash ?? "")
      : Boolean(user.passwordHash) &&
        compareSync(input.password, user.passwordHash ?? "");

    if (!validCredentials) {
      logSecurityEvent("auth.login_failed", {
        reason: "bad_credentials",
        mode,
        identifier,
        ip,
      });
      return { ok: false, message: "Invalid credentials." };
    }

    logSecurityEvent("auth.login_success", {
      userId: user.id,
      email: user.email,
      mode,
      ip,
    });

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleGlobal: user.roleGlobal,
      },
    };
  },

  async establishSession(userId, context) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + SESSION_TTL_SECONDS;
    const sessionToken = generateOneTimeToken();

    const convex = getConvexClient();

    if (convex) {
      const sessionId = await convex.mutation(api.auth.create, {
        userId,
        tokenHash: hashOpaqueToken(sessionToken),
        ...(context?.userAgent ? { userAgent: context.userAgent } : {}),
        ...(context?.deviceId ? { deviceId: context.deviceId } : {}),
        ...(context?.ipAddress ? { ipAddress: context.ipAddress } : {}),
        expiresAt: expiresAt * 1000,
      });

      await setSessionCookie({
        uid: userId,
        sid: sessionId,
        st: sessionToken,
        iat: issuedAt,
        exp: expiresAt,
      });
      return;
    }

    // Prisma fallback
    if (!db) throw new Error("No database configured");
    const session = await db.authSession.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(sessionToken),
        userAgent: context?.userAgent ?? null,
        deviceId: context?.deviceId ?? null,
        ipAddress: context?.ipAddress ?? null,
        expiresAt: new Date(expiresAt * 1000),
      },
    });

    await setSessionCookie({
      uid: userId,
      sid: session.id,
      st: sessionToken,
      iat: issuedAt,
      exp: expiresAt,
    });
  },

  async clearSession(reason = "user_logout") {
    const payload = await getSessionPayload();

    if (payload?.sid) {
      const convex = getConvexClient();
      if (convex) {
        await convex.mutation(api.auth.revoke, {
          id: payload.sid as Id<"authSessions">,
          reason,
        }).catch(() => {});
      } else if (db) {
        await db.authSession.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: reason },
        });
      }
    }

    await clearSessionCookie();
  },

  async getSession() {
    const payload = await getSessionPayload();

    if (!payload) {
      return null;
    }

    return resolveSession(payload);
  },

  async listActiveSessions(userId) {
    const currentSessionId = await this.getCurrentSessionId();

    const convex = getConvexClient();
    if (convex) {
      const sessions = await convex.query(api.auth.listActiveSessions, {
        userId: userId as Id<"users">,
      });
      return sessions.map((s) => ({
        id: s._id,
        userAgent: s.userAgent ?? null,
        deviceId: s.deviceId ?? null,
        ipAddress: s.ipAddress ?? null,
        createdAt: new Date(s._creationTime),
        lastSeenAt: new Date(s.lastSeenAt ?? s._creationTime),
        expiresAt: new Date(s.expiresAt),
        elevatedUntil: s.elevatedUntil ? new Date(s.elevatedUntil) : null,
        isCurrent: currentSessionId === s._id,
      }));
    }

    // Prisma fallback
    if (!db) return [];
    const now = new Date();
    const sessions = await db.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      deviceId: session.deviceId,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      elevatedUntil: session.elevatedUntil,
      isCurrent: currentSessionId === session.id,
    }));
  },

  async revokeSessionById(userId, sessionId) {
    const convex = getConvexClient();
    if (convex) {
      await convex.mutation(api.auth.revokeBySessionAndUser, {
        sessionId: sessionId as Id<"authSessions">,
        userId: userId as Id<"users">,
        reason: "user_revoked",
      });
    } else if (db) {
      await db.authSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "user_revoked" },
      });
    }

    const currentSessionId = await this.getCurrentSessionId();
    if (currentSessionId === sessionId) {
      await clearSessionCookie();
    }
  },

  async revokeAllSessions(userId, exceptSessionId) {
    const convex = getConvexClient();
    if (convex) {
      await convex.mutation(api.auth.revokeAllExcept, {
        userId: userId as Id<"users">,
        ...(exceptSessionId ? { exceptSessionId: exceptSessionId as Id<"authSessions"> } : {}),
        reason: "user_revoked_all",
      });
    } else if (db) {
      await db.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
        },
        data: { revokedAt: new Date(), revokedReason: "user_revoked_all" },
      });
    }
  },

  async elevateCurrentSessionUntil(userId, until) {
    const payload = await getSessionPayload();
    if (!payload) return false;

    const convex = getConvexClient();
    if (convex) {
      return convex.mutation(api.auth.elevateSession, {
        sessionId: payload.sid as Id<"authSessions">,
        userId: userId as Id<"users">,
        elevatedUntil: until.getTime(),
      });
    }

    if (!db) return false;
    const result = await db.authSession.updateMany({
      where: {
        id: payload.sid,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { elevatedUntil: until },
    });
    return result.count > 0;
  },

  async getCurrentSessionId() {
    const payload = await getSessionPayload();
    return payload?.sid ?? null;
  },

  async getSessionUser(): Promise<SessionUser | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  },
};
