import { z } from "zod";

import { checkAuthThrottle, buildAuthThrottleKeys, registerAuthFailure, registerAuthSuccess } from "@/lib/auth/throttle";
import { createSessionForUser, verifyCredentials } from "@/lib/auth/session";
import { normalizeEmail, normalizeLoginName } from "@/lib/auth/tokens";
import { appendAuditLog } from "@/lib/audit";
import { createErrorId, getRequestId, logWebRequest, withObservabilityHeaders } from "@/lib/http-observability";
import { appendSecurityEvent } from "@/lib/security-events";
import {
  getClientDeviceId,
  getClientIp,
  isSameOriginRequest,
  logSecurityEvent,
} from "@/lib/security";
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
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/login";
  const ipAddress = getClientIp(request);
  const deviceId = getClientDeviceId(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  if (!isSameOriginRequest(request)) {
    const response = Response.json(
      { ok: false, message: "Cross-origin request blocked." },
      withObservabilityHeaders({ status: 403 }, requestId),
    );

    logWebRequest({
      event: "web.auth.login",
      requestId,
      route,
      method: request.method,
      status: 403,
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
      event: "web.auth.login",
      requestId,
      route,
      method: request.method,
      status: 400,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    const response = Response.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid credentials payload.",
      },
      withObservabilityHeaders({ status: 400 }, requestId),
    );

    logWebRequest({
      event: "web.auth.login",
      requestId,
      route,
      method: request.method,
      status: 400,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const accountIdentifier = "pin" in parsed.data
    ? normalizeLoginName(parsed.data.loginName)
    : normalizeEmail(parsed.data.email);

  const throttleKeys = buildAuthThrottleKeys({
    ipAddress,
    deviceId,
    accountIdentifier,
  });

  const throttle = await checkAuthThrottle(throttleKeys);

  if (!throttle.allowed) {
    await appendSecurityEvent({
      event: "auth.login_blocked_lockout",
      severity: "warn",
      requestId,
      ipAddress,
      deviceId,
      route,
      details: {
        blockedBy: throttle.blockedBy,
        retryAfterSeconds: throttle.retryAfterSeconds,
        accountIdentifier,
      },
    });

    const response = Response.json(
      {
        ok: false,
        message: "Account temporarily locked due to repeated failed attempts.",
      },
      withObservabilityHeaders(
        {
          status: 429,
          headers: {
            "Retry-After": String(throttle.retryAfterSeconds),
          },
        },
        requestId,
      ),
    );

    logWebRequest({
      event: "web.auth.login",
      requestId,
      route,
      method: request.method,
      status: 429,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  try {
    const result = await verifyCredentials(
      "pin" in parsed.data
        ? {
            loginName: parsed.data.loginName,
            pin: parsed.data.pin,
            ip: ipAddress,
            deviceId,
            userAgent,
            requestId,
            route,
          }
        : {
            email: parsed.data.email,
            password: parsed.data.password,
            ip: ipAddress,
            deviceId,
            userAgent,
            requestId,
            route,
          },
    );

    if (!result.ok) {
      await registerAuthFailure(throttleKeys, {
        requestId,
        route,
        ipAddress,
        deviceId,
        accountIdentifier,
      });

      const response = Response.json(
        { ok: false, message: result.message },
        withObservabilityHeaders({ status: 401 }, requestId),
      );

      logWebRequest({
        event: "web.auth.login",
        requestId,
        route,
        method: request.method,
        status: 401,
        durationMs: Date.now() - startedAt,
      });

      return response;
    }

    await registerAuthSuccess(throttleKeys, {
      requestId,
      route,
      ipAddress,
      deviceId,
      targetUserId: result.user.id,
      accountIdentifier,
    });

    await createSessionForUser(result.user.id, {
      ipAddress,
      userAgent,
      deviceId,
    });

    const membership = await getDefaultWorkspaceForUser(result.user.id);
    if (membership) {
      await appendAuditLog({
        workspaceId: membership.workspaceId,
        actorUserId: result.user.id,
        action: "auth.login",
        entityType: "session",
        entityId: result.user.id,
        metaJson: {
          ip: ipAddress,
          requestId,
          deviceId,
        },
        source: "api",
      });
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
      event: "web.auth.login",
      requestId,
      route,
      method: request.method,
      status: 200,
      durationMs: Date.now() - startedAt,
      userId: result.user.id,
    });

    return response;
  } catch (error) {
    const errorId = createErrorId();

    logSecurityEvent("auth.login_error", {
      requestId,
      errorId,
      message: error instanceof Error ? error.message : "unknown",
    });

    const response = Response.json(
      {
        ok: false,
        message: `Login failed. Reference: ${errorId}`,
      },
      withObservabilityHeaders({ status: 500 }, requestId, errorId),
    );

    logWebRequest({
      event: "web.auth.login",
      requestId,
      route,
      method: request.method,
      status: 500,
      durationMs: Date.now() - startedAt,
      errorId,
    });

    return response;
  }
}
