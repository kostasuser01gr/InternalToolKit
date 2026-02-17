import type { AuthAdapter } from "@/lib/auth/adapter";
import { cookieAuthAdapter } from "@/lib/auth/cookie-adapter";
import type { AppSession } from "@/lib/auth/types";

const authAdapter: AuthAdapter = cookieAuthAdapter;

export async function getSession() {
  const user = await authAdapter.getSessionUser();

  if (!user) {
    return null;
  }

  return { user } satisfies AppSession;
}

export async function requireSession() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  return session;
}

export async function createSessionForUser(userId: string) {
  await authAdapter.establishSession(userId);
}

export async function clearSession() {
  await authAdapter.clearSession();
}

export async function verifyCredentials(input: {
  email: string;
  password: string;
  ip?: string;
}) {
  return authAdapter.signInWithCredentials(input);
}
