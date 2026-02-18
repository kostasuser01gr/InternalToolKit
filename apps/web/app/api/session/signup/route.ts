import { z } from "zod";

import { createSessionForUser } from "@/lib/auth/session";
import { signupWithPassword } from "@/lib/auth/signup";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOriginRequest, logSecurityEvent } from "@/lib/security";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  loginName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Login name can use letters, numbers, dot, dash and underscore."),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const signupRateLimit = checkRateLimit({
    key: `auth.signup:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!signupRateLimit.allowed) {
    logSecurityEvent("auth.signup_rate_limited", { ip });
    return Response.json(
      {
        ok: false,
        message: "Too many signup attempts. Please wait and retry.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(signupRateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid signup payload.",
      },
      { status: 400 },
    );
  }

  const result = await signupWithPassword({
    name: parsed.data.name,
    loginName: parsed.data.loginName,
    pin: parsed.data.pin,
    email: parsed.data.email,
    password: parsed.data.password,
    ...(ip ? { ip } : {}),
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.message },
      {
        status: result.reason === "email_taken" ? 409 : 500,
      },
    );
  }

  await createSessionForUser(result.user.id);

  return Response.json({
    ok: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roleGlobal: result.user.roleGlobal,
    },
  });
}
