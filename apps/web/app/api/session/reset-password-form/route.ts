import { z } from "zod";

import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { createSessionForUser } from "@/lib/auth/session";
import { getRequestId, logWebRequest } from "@/lib/http-observability";
import { getClientDeviceId, getClientIp, isSameOriginRequest } from "@/lib/security";

const resetSchema = z
  .object({
    token: z.string().trim().min(20).max(300),
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

function buildResetUrl(request: Request, token: string, message: string, requestId: string) {
  const url = new URL("/reset-password", getRequestOrigin(request));
  url.searchParams.set("code", token);
  url.searchParams.set("error", message);
  url.searchParams.set("requestId", requestId);
  return url;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/reset-password-form";

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
      event: "web.auth.password_reset_complete",
      requestId,
      route,
      method: request.method,
      status: 403,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const formData = await request.formData();
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const token = typeof formData.get("token") === "string" ? (formData.get("token") as string) : "";
    const response = Response.redirect(
      buildResetUrl(
        request,
        token,
        parsed.error.issues[0]?.message ?? "Invalid reset payload.",
        requestId,
      ),
      303,
    );

    logWebRequest({
      event: "web.auth.password_reset_complete",
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

  const reset = await resetPasswordWithToken({
    token: parsed.data.token,
    password: parsed.data.password,
    requestId,
    ipAddress,
    deviceId,
    route,
  });

  if (!reset.ok) {
    const response = Response.redirect(
      buildResetUrl(request, parsed.data.token, reset.message, requestId),
      303,
    );

    logWebRequest({
      event: "web.auth.password_reset_complete",
      requestId,
      route,
      method: request.method,
      status: 303,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  await createSessionForUser(reset.userId, {
    ipAddress,
    userAgent,
    deviceId,
  });

  const response = Response.redirect(new URL("/overview", getRequestOrigin(request)), 303);

  logWebRequest({
    event: "web.auth.password_reset_complete",
    requestId,
    route,
    method: request.method,
    status: 303,
    durationMs: Date.now() - startedAt,
    userId: reset.userId,
  });

  return response;
}
