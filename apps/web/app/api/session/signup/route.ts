import { z } from "zod";

import { createSessionForUser } from "@/lib/auth/session";
import { signupWithPassword } from "@/lib/auth/signup";
import { getRequestId, logWebRequest, withObservabilityHeaders } from "@/lib/http-observability";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getClientDeviceId,
  getClientIp,
  isSameOriginRequest,
  logSecurityEvent,
} from "@/lib/security";

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
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/signup";

  if (!isSameOriginRequest(request)) {
    const response = Response.json(
      { ok: false, message: "Cross-origin request blocked." },
      withObservabilityHeaders({ status: 403 }, requestId),
    );
    logWebRequest({
      event: "web.auth.signup",
      requestId,
      route,
      method: request.method,
      status: 403,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  const ip = getClientIp(request);
  const deviceId = getClientDeviceId(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const signupRateLimit = checkRateLimit({
    key: `auth.signup:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!signupRateLimit.allowed) {
    logSecurityEvent("auth.signup_rate_limited", { ip });
    const response = Response.json(
      {
        ok: false,
        message: "Too many signup attempts. Please wait and retry.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(signupRateLimit.retryAfterSeconds),
          "X-Request-Id": requestId,
        },
      },
    );
    logWebRequest({
      event: "web.auth.signup",
      requestId,
      route,
      method: request.method,
      status: 429,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    const response = Response.json(
      { ok: false, message: "Invalid JSON payload." },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
    logWebRequest({
      event: "web.auth.signup",
      requestId,
      route,
      method: request.method,
      status: 400,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  const parsed = signupSchema.safeParse(payload);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid signup payload.",
      },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
    logWebRequest({
      event: "web.auth.signup",
      requestId,
      route,
      method: request.method,
      status: 400,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  const result = await signupWithPassword({
    name: parsed.data.name,
    loginName: parsed.data.loginName,
    pin: parsed.data.pin,
    email: parsed.data.email,
    password: parsed.data.password,
    ...(ip ? { ip } : {}),
    requestId,
  });

  if (!result.ok) {
    const status =
      result.reason === "email_taken" || result.reason === "login_taken"
        ? 409
        : 503;

    const response = Response.json(
      { ok: false, message: result.message },
      withObservabilityHeaders(
        {
          status,
        },
        requestId,
      ),
    );
    logWebRequest({
      event: "web.auth.signup",
      requestId,
      route,
      method: request.method,
      status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  try {
    await createSessionForUser(result.user.id, {
      ipAddress: ip,
      userAgent,
      deviceId,
    });
  } catch (error) {
    logSecurityEvent("auth.signup_session_failed", {
      requestId,
      userId: result.user.id,
      message: error instanceof Error ? error.message : "unknown",
    });

    const response = Response.json(
      {
        ok: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          roleGlobal: result.user.roleGlobal,
        },
        warning: "Account created. Sign in to continue.",
      },
      withObservabilityHeaders({ status: 200 }, requestId),
    );

    logWebRequest({
      event: "web.auth.signup",
      requestId,
      route,
      method: request.method,
      status: 200,
      durationMs: Date.now() - startedAt,
      userId: result.user.id,
      details: { sessionEstablished: false },
    });

    return response;
  }

  const response = Response.json(
    {
      ok: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        roleGlobal: result.user.roleGlobal,
      },
    },
    withObservabilityHeaders({ status: 200 }, requestId),
  );

  logWebRequest({
    event: "web.auth.signup",
    requestId,
    route,
    method: request.method,
    status: 200,
    durationMs: Date.now() - startedAt,
    userId: result.user.id,
  });

  return response;
}
