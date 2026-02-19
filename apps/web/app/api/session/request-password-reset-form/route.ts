import { z } from "zod";

import { requestPasswordReset } from "@/lib/auth/password-reset";
import { getRequestId, logWebRequest } from "@/lib/http-observability";
import { getClientDeviceId, getClientIp, isSameOriginRequest } from "@/lib/security";

const requestSchema = z.object({
  email: z.string().trim().email().max(200),
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

function buildForgotPasswordUrl(
  request: Request,
  message: string,
  requestId: string,
  resetCode?: string,
) {
  const url = new URL("/forgot-password", getRequestOrigin(request));
  url.searchParams.set("success", message);
  url.searchParams.set("requestId", requestId);

  if (resetCode) {
    url.searchParams.set("resetCode", resetCode);
  }

  return url;
}

function buildForgotPasswordErrorUrl(
  request: Request,
  message: string,
  requestId: string,
) {
  const url = new URL("/forgot-password", getRequestOrigin(request));
  url.searchParams.set("error", message);
  url.searchParams.set("requestId", requestId);
  return url;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const route = "/api/session/request-password-reset-form";

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
      event: "web.auth.password_reset_request",
      requestId,
      route,
      method: request.method,
      status: 403,
      durationMs: Date.now() - startedAt,
    });

    return response;
  }

  const formData = await request.formData();
  const parsed = requestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const response = Response.redirect(
      buildForgotPasswordErrorUrl(
        request,
        parsed.error.issues[0]?.message ?? "Invalid email.",
        requestId,
      ),
      303,
    );

    logWebRequest({
      event: "web.auth.password_reset_request",
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

  const requested = await requestPasswordReset({
    email: parsed.data.email,
    requestId,
    ipAddress,
    deviceId,
    userAgent,
    route,
  });

  const response = Response.redirect(
    buildForgotPasswordUrl(
      request,
      "If the account exists, a reset token has been issued.",
      requestId,
      requested.tokenForDebug,
    ),
    303,
  );

  logWebRequest({
    event: "web.auth.password_reset_request",
    requestId,
    route,
    method: request.method,
    status: 303,
    durationMs: Date.now() - startedAt,
  });

  return response;
}
