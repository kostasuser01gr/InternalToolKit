import { z } from "zod";

import { createSessionForUser } from "@/lib/auth/session";
import { signupWithPassword } from "@/lib/auth/signup";
import { getRequestId, logWebRequest } from "@/lib/http-observability";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getClientDeviceId,
  getClientIp,
  isSameOriginRequest,
  logSecurityEvent,
} from "@/lib/security";

const formSchema = z
  .object({
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
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

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

function buildSignupUrl(
  request: Request,
  callbackUrl: string,
  errorMessage: string,
  requestId?: string,
  errorId?: string,
) {
  const url = new URL("/signup", getRequestOrigin(request));
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
  const route = "/api/session/signup-form";

  if (!isSameOriginRequest(request)) {
    const response = Response.json(
      { ok: false, message: "Cross-origin request blocked." },
      { status: 403, headers: { "X-Request-Id": requestId } },
    );

    logWebRequest({
      event: "web.auth.signup_form",
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

  const signupRateLimit = checkRateLimit({
    key: `auth.signup-form:${ipAddress}`,
    limit: 5,
    windowMs: 60_000,
  });

  if (!signupRateLimit.allowed) {
    logSecurityEvent("auth.signup_form_rate_limited", { ipAddress });

    const response = Response.redirect(
      buildSignupUrl(
        request,
        callbackUrl,
        "Too many attempts. Please wait and try again.",
        requestId,
      ),
      303,
    );


    logWebRequest({
      event: "web.auth.signup_form",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const formData = await request.formData();
  const parsed = formSchema.safeParse({
    name: formData.get("name"),
    loginName: formData.get("loginName"),
    pin: formData.get("pin"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const response = Response.redirect(
      buildSignupUrl(
        request,
        callbackUrl,
        parsed.error.issues[0]?.message ?? "Invalid signup payload.",
        requestId,
      ),
      303,
    );


    logWebRequest({
      event: "web.auth.signup_form",
      requestId,
      route,
      method: request.method,
      status: 303,
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
    ip: ipAddress,
    requestId,
  });

  if (!result.ok) {
    const response = Response.redirect(
      buildSignupUrl(request, callbackUrl, result.message, requestId),
      303,
    );


    logWebRequest({
      event: "web.auth.signup_form",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  try {
    await createSessionForUser(result.user.id, {
      ipAddress,
      userAgent,
      deviceId,
    });
  } catch (error) {
    logSecurityEvent("auth.signup_form_session_failed", {
      requestId,
      userId: result.user.id,
      message: error instanceof Error ? error.message : "unknown",
    });

    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    loginUrl.searchParams.set(
      "error",
      "Account created. Please sign in to continue.",
    );
    loginUrl.searchParams.set("requestId", requestId);

    const response = Response.redirect(loginUrl, 303);

    logWebRequest({
      event: "web.auth.signup_form",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
      userId: result.user.id,
      details: { sessionEstablished: false },
    });

    return response;
  }

  const response = Response.redirect(new URL(callbackUrl, getRequestOrigin(request)), 303);

  logWebRequest({
    event: "web.auth.signup_form",
    requestId,
    route,
    method: request.method,
    status: 303,
    durationMs: Date.now() - startedAt,
    userId: result.user.id,
  });

  return response;
}
