import type { SessionUser } from "@/lib/auth/types";

type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; message: string };

export type AuthAdapter = {
  signInWithCredentials(input: {
    email: string;
    password: string;
    ip?: string;
  }): Promise<SignInResult>;
  establishSession(userId: string): Promise<void>;
  clearSession(): Promise<void>;
  getSessionUser(): Promise<SessionUser | null>;
};
