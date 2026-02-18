import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { createSessionForUser, verifyCredentials } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOriginRequest, logSecurityEvent } from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

const passwordLoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

const pinLoginSchema = z.object({
  loginName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Login name can use letters, numbers, dot, dash and underscore."),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

const loginSchema = z.union([passwordLoginSchema, pinLoginSchema]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const loginRateLimit = checkRateLimit({
    key: `auth.login:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!loginRateLimit.allowed) {
    logSecurityEvent("auth.login_rate_limited", { ip });
    return Response.json(
      {
        ok: false,
        message: "Too many login attempts. Please wait and retry.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(loginRateLimit.retryAfterSeconds),
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

  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid credentials payload.",
      },
      { status: 400 },
    );
  }

  const result = await verifyCredentials(
    "pin" in parsed.data
      ? {
          loginName: parsed.data.loginName,
          pin: parsed.data.pin,
          ...(ip ? { ip } : {}),
        }
      : {
          email: parsed.data.email,
          password: parsed.data.password,
          ...(ip ? { ip } : {}),
        },
  );

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 401 });
  }

  await createSessionForUser(result.user.id);

  const membership = await getDefaultWorkspaceForUser(result.user.id);
  if (membership) {
    await appendAuditLog({
      workspaceId: membership.workspaceId,
      actorUserId: result.user.id,
      action: "auth.login",
      entityType: "session",
      entityId: result.user.id,
      metaJson: {
        ip,
      },
      source: "api",
    });
  }

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
