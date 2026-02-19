import { compareSync } from "bcryptjs";

import type { AuthAdapter, AuthCredentials, SessionEstablishContext } from "@/lib/auth/adapter";
import { cookieAuthAdapter } from "@/lib/auth/cookie-adapter";
import type { ActiveSessionInfo } from "@/lib/auth/types";
import { db } from "@/lib/db";

const authAdapter: AuthAdapter = cookieAuthAdapter;
const ADMIN_STEP_UP_TTL_MS = 10 * 60 * 1000;

export async function getSession() {
  return authAdapter.getSession();
}

export async function requireSession() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  return session;
}

export async function createSessionForUser(
  userId: string,
  context?: SessionEstablishContext,
) {
  await authAdapter.establishSession(userId, context);
}

export async function clearSession(reason?: string) {
  await authAdapter.clearSession(reason);
}

export async function verifyCredentials(input: AuthCredentials) {
  return authAdapter.signInWithCredentials(input);
}

export async function listActiveSessionsForUser(userId: string): Promise<ActiveSessionInfo[]> {
  return authAdapter.listActiveSessions(userId);
}

export async function revokeSessionForUser(userId: string, sessionId: string) {
  await authAdapter.revokeSessionById(userId, sessionId);
}

export async function revokeAllSessionsForUser(userId: string, exceptSessionId?: string) {
  await authAdapter.revokeAllSessions(userId, exceptSessionId);
}

export async function getCurrentSessionId() {
  return authAdapter.getCurrentSessionId();
}

export async function hasRecentAdminStepUp() {
  const session = await requireSession();
  if (!session) {
    return false;
  }

  if (!session.session.elevatedUntil) {
    return false;
  }

  return session.session.elevatedUntil.getTime() > Date.now();
}

export async function verifyAdminStepUpPin(pin: string) {
  const session = await requireSession();
  if (!session) {
    return false;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      pinHash: true,
    },
  });

  if (!user?.pinHash) {
    return false;
  }

  if (!compareSync(pin, user.pinHash)) {
    return false;
  }

  const until = new Date(Date.now() + ADMIN_STEP_UP_TTL_MS);
  const elevated = await authAdapter.elevateCurrentSessionUntil(user.id, until);

  if (!elevated) {
    return false;
  }

  return true;
}
