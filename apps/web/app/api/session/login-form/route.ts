import { z } from "zod";

import { checkAuthThrottle, buildAuthThrottleKeys, registerAuthFailure, registerAuthSuccess } from "@/lib/auth/throttle";
import { createSessionForUser, verifyCredentials } from "@/lib/auth/session";
import { normalizeEmail, normalizeLoginName } from "@/lib/auth/tokens";
import { appendAuditLog } from "@/lib/audit";
import { getAuthRuntimeEnvError } from "@/lib/env";
import { createErrorId, getRequestId, logWebRequest } from "@/lib/http-observability";
import { appendSecurityEvent } from "@/lib/security-events";
import {
  getClientDeviceId,
  getClientIp,
  isSameOriginRequest,
  logSecurityEvent,
} from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

const passwordFormSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().trim().min(8).max(200),
});

const pinFormSchema = z.object({
  loginName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Login name can use letters, numbers, dot, dash and underscore."),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

const loginMethodSchema = z.enum(["pin", "password"]);

function getRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

function buildLoginUrl(
  request: Request,
  callbackUrl: string,
  errorMessage: string,
  requestId?: string,
  errorId?: string,
) {
  const url = new URL("/login", getRequestOrigin(request));
  url.searchParams.set("callbackUrl", callbackUrl);
  url.searchParams.set("error", errorMessage);

  if (requestId) {
    url.searchParams.set("requestId", requestId);
  }

  if (errorId) {
    url.searchParams.set("errorId", errorId);
  }

  return url;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/login-form";

  if (!isSameOriginRequest(request)) {
    const response = Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403, headers: { "X-Request-Id": requestId } });

    logWebRequest({
      event: "web.auth.login_form",
      requestId,
      route,
      method: request.method,
      status: 403,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl")?.startsWith("/")
    ? (searchParams.get("callbackUrl") as string)
    : "/overview";

  const ipAddress = getClientIp(request);
  const deviceId = getClientDeviceId(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const envError = getAuthRuntimeEnvError();

  if (envError) {
    const response = Response.redirect(
      buildLoginUrl(request, callbackUrl, envError, requestId),
      303,
    );

    logWebRequest({
      event: "web.auth.login_form",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
      details: { envError: true },
    });

    return response;
  }

  const formData = await request.formData();
  const methodRaw = formData.get("method");
  const requestedMethod = loginMethodSchema.safeParse(methodRaw);
  const loginNameValue =
    typeof formData.get("loginName") === "string"
      ? String(formData.get("loginName")).trim()
      : "";
  const pinValue =
    typeof formData.get("pin") === "string"
      ? String(formData.get("pin")).trim()
      : "";
  const hasPinCredentials = loginNameValue.length > 0 || pinValue.length > 0;
  const shouldUsePinFlow = requestedMethod.success
    ? requestedMethod.data === "pin"
    : hasPinCredentials;

  const parsed = shouldUsePinFlow
    ? pinFormSchema.safeParse({
        loginName: formData.get("loginName"),
        pin: formData.get("pin"),
      })
    : passwordFormSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
      });

  if (!parsed.success) {
    const response = Response.redirect(
      buildLoginUrl(
        request,
        callbackUrl,
        parsed.error.issues[0]?.message ?? "Invalid credentials payload.",
        requestId,
      ),
      303,
    );


    logWebRequest({
      event: "web.auth.login_form",
      requestId,
      route,
      method: request.method,
      status: 303,
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
      event: "auth.login_form_blocked_lockout",
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

    const response = Response.redirect(
      buildLoginUrl(
        request,
        callbackUrl,
        "Account temporarily locked due to repeated failed attempts.",
        requestId,
      ),
      303,
    );


    logWebRequest({
      event: "web.auth.login_form",
      requestId,
      route,
      method: request.method,
      status: 303,
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

      const response = Response.redirect(
        buildLoginUrl(request, callbackUrl, result.message, requestId),
        303,
      );


      logWebRequest({
        event: "web.auth.login_form",
        requestId,
        route,
        method: request.method,
        status: 303,
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
        metaJson: { ip: ipAddress, requestId, deviceId },
        source: "api",
      });
    }

    const response = Response.redirect(new URL(callbackUrl, getRequestOrigin(request)), 303);

    logWebRequest({
      event: "web.auth.login_form",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
      userId: result.user.id,
    });

    return response;
  } catch (error) {
    const errorId = createErrorId();

    logSecurityEvent("auth.login_form_error", {
      requestId,
      errorId,
      message: error instanceof Error ? error.message : "unknown",
    });

    const response = Response.redirect(
      buildLoginUrl(
        request,
        callbackUrl,
        `Login failed. Reference: ${errorId}`,
        requestId,
        errorId,
      ),
      303,
    );


    logWebRequest({
      event: "web.auth.login_form",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
      errorId,
    });

    return response;
  }
}
