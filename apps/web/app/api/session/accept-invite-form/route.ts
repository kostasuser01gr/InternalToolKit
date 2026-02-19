import { z } from "zod";

import { acceptWorkspaceInvite } from "@/lib/auth/invite";
import { createSessionForUser } from "@/lib/auth/session";
import { getRequestId, logWebRequest } from "@/lib/http-observability";
import { getClientDeviceId, getClientIp, isSameOriginRequest } from "@/lib/security";

const acceptInviteSchema = z
  .object({
    token: z.string().trim().min(20).max(300),
    name: z.string().trim().min(2).max(80),
    loginName: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-zA-Z0-9._-]+$/, "Login name can use letters, numbers, dot, dash and underscore."),
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
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

function buildAcceptInviteUrl(request: Request, token: string, message: string, requestId: string) {
  const url = new URL("/accept-invite", getRequestOrigin(request));
  url.searchParams.set("code", token);
  url.searchParams.set("error", message);
  url.searchParams.set("requestId", requestId);
  return url;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/accept-invite-form";

  if (!isSameOriginRequest(request)) {
    const response = Response.json(
      { ok: false, message: "Cross-origin request blocked." },
      {
        status: 403,
        headers: {
          "X-Request-Id": requestId,
        },
      },
    );

    logWebRequest({
      event: "web.auth.accept_invite",
      requestId,
      route,
      method: request.method,
      status: 403,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const formData = await request.formData();
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    loginName: formData.get("loginName"),
    pin: formData.get("pin"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const token = typeof formData.get("token") === "string" ? (formData.get("token") as string) : "";
    const response = Response.redirect(
      buildAcceptInviteUrl(
        request,
        token,
        parsed.error.issues[0]?.message ?? "Invalid invite payload.",
        requestId,
      ),
      303,
    );

    logWebRequest({
      event: "web.auth.accept_invite",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const ipAddress = getClientIp(request);
  const deviceId = getClientDeviceId(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const accepted = await acceptWorkspaceInvite({
    token: parsed.data.token,
    name: parsed.data.name,
    loginName: parsed.data.loginName,
    pin: parsed.data.pin,
    password: parsed.data.password,
    requestId,
    ipAddress,
    deviceId,
    route,
  });

  if (!accepted.ok) {
    const response = Response.redirect(
      buildAcceptInviteUrl(
        request,
        parsed.data.token,
        accepted.message,
        requestId,
      ),
      303,
    );

    logWebRequest({
      event: "web.auth.accept_invite",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  await createSessionForUser(accepted.userId, {
    ipAddress,
    userAgent,
    deviceId,
  });

  const response = Response.redirect(new URL("/overview", getRequestOrigin(request)), 303);

  logWebRequest({
    event: "web.auth.accept_invite",
    requestId,
    route,
    method: request.method,
    status: 303,
    durationMs: Date.now() - startedAt,
    userId: accepted.userId,
  });

  return response;
}
