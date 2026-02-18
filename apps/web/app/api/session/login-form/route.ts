import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { createSessionForUser, verifyCredentials } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOriginRequest, logSecurityEvent } from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

const passwordFormSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
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

function buildLoginUrl(request: Request, callbackUrl: string, errorMessage: string) {
  const url = new URL("/login", getRequestOrigin(request));
  url.searchParams.set("callbackUrl", callbackUrl);
  url.searchParams.set("error", errorMessage);
  return url;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, message: "Cross-origin request blocked." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl")?.startsWith("/")
    ? (searchParams.get("callbackUrl") as string)
    : "/overview";

  const ip = getClientIp(request);
  const loginRateLimit = checkRateLimit({
    key: `auth.login-form:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!loginRateLimit.allowed) {
    logSecurityEvent("auth.login_form_rate_limited", { ip });
    return Response.redirect(
      buildLoginUrl(
        request,
        callbackUrl,
        "Too many attempts. Please wait and try again.",
      ),
      303,
    );
  }

  const formData = await request.formData();
  const loginName = formData.get("loginName");
  const pin = formData.get("pin");

  const usesPinFlow =
    typeof loginName === "string" ||
    typeof pin === "string";

  const parsed = usesPinFlow
    ? pinFormSchema.safeParse({
        loginName,
        pin,
      })
    : passwordFormSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
      });

  if (!parsed.success) {
    return Response.redirect(
      buildLoginUrl(
        request,
        callbackUrl,
        parsed.error.issues[0]?.message ?? "Invalid credentials payload.",
      ),
      303,
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
    return Response.redirect(
      buildLoginUrl(request, callbackUrl, result.message),
      303,
    );
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
      metaJson: { ip },
      source: "api",
    });
  }

  return Response.redirect(new URL(callbackUrl, getRequestOrigin(request)), 303);
}
