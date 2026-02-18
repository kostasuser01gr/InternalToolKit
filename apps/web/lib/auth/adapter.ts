import type { SessionUser } from "@/lib/auth/types";

type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; message: string };

export type PasswordCredentials = {
  method?: "password";
  email: string;
  password: string;
  ip?: string;
};

export type PinCredentials = {
  method?: "pin";
  loginName: string;
  pin: string;
  ip?: string;
};

export type AuthCredentials = PasswordCredentials | PinCredentials;

export type AuthAdapter = {
  signInWithCredentials(input: AuthCredentials): Promise<SignInResult>;
  establishSession(userId: string): Promise<void>;
  clearSession(): Promise<void>;
  getSessionUser(): Promise<SessionUser | null>;
};
