import { compareSync } from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { AuthAdapter } from "@/lib/auth/adapter";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SAME_SITE,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import { getServerEnv } from "@/lib/env";
import type { SessionUser } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security";

type SessionPayload = {
  uid: string;
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
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
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

async function setSessionCookie(userId: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;
  const token = encodeToken({
    uid: userId,
    iat: issuedAt,
    exp: expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: SESSION_COOKIE_SECURE,
    path: "/",
    expires: new Date(expiresAt * 1000),
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

export const cookieAuthAdapter: AuthAdapter = {
  async signInWithCredentials({ email, password, ip }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !compareSync(password, user.passwordHash)) {
      logSecurityEvent("auth.login_failed", {
        reason: "bad_credentials",
        email: normalizedEmail,
        ip: ip ?? "unknown",
      });
      return { ok: false, message: "Invalid credentials." };
    }

    logSecurityEvent("auth.login_success", {
      userId: user.id,
      email: user.email,
      ip: ip ?? "unknown",
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

  async establishSession(userId) {
    await setSessionCookie(userId);
  },

  async clearSession() {
    await clearSessionCookie();
  },

  async getSessionUser(): Promise<SessionUser | null> {
    const payload = await getSessionPayload();

    if (!payload) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: payload.uid },
      select: {
        id: true,
        email: true,
        name: true,
        roleGlobal: true,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  },
};
