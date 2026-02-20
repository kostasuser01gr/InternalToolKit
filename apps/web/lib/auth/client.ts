"use client";

type LoginInput = {
  email: string;
  password: string;
};

type LoginResponse =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

export async function loginWithPassword(input: LoginInput): Promise<LoginResponse> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  const response = await fetch("/api/session/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as { ok?: boolean; message?: string };

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      message: payload.message ?? "Unable to sign in with these credentials.",
    };
  }

  return { ok: true };
}

export async function logoutSession() {
  await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  });
}
