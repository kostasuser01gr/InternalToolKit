import type { ActiveSessionInfo, AppSession, SessionUser } from "@/lib/auth/types";

type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; message: string };

export type PasswordCredentials = {
  method?: "password";
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  requestId?: string;
  route?: string;
};

export type PinCredentials = {
  method?: "pin";
  loginName: string;
  pin: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  requestId?: string;
  route?: string;
};

export type AuthCredentials = PasswordCredentials | PinCredentials;

export type SessionEstablishContext = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
};

export type AuthAdapter = {
  signInWithCredentials(input: AuthCredentials): Promise<SignInResult>;
  establishSession(userId: string, context?: SessionEstablishContext): Promise<void>;
  clearSession(reason?: string): Promise<void>;
  getSession(): Promise<AppSession | null>;
  listActiveSessions(userId: string): Promise<ActiveSessionInfo[]>;
  revokeSessionById(userId: string, sessionId: string): Promise<void>;
  revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void>;
  elevateCurrentSessionUntil(userId: string, until: Date): Promise<boolean>;
  getCurrentSessionId(): Promise<string | null>;
  getSessionUser(): Promise<SessionUser | null>;
};
