import { z } from "zod";

import { createSessionForUser } from "@/lib/auth/session";
import { signupWithPassword } from "@/lib/auth/signup";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOriginRequest, logSecurityEvent } from "@/lib/security";

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

function buildSignupUrl(request: Request, callbackUrl: string, errorMessage: string) {
  const url = new URL("/signup", getRequestOrigin(request));
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
  const signupRateLimit = checkRateLimit({
    key: `auth.signup-form:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!signupRateLimit.allowed) {
    logSecurityEvent("auth.signup_form_rate_limited", { ip });
    return Response.redirect(
      buildSignupUrl(
        request,
        callbackUrl,
        "Too many attempts. Please wait and try again.",
      ),
      303,
    );
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
    return Response.redirect(
      buildSignupUrl(
        request,
        callbackUrl,
        parsed.error.issues[0]?.message ?? "Invalid signup payload.",
      ),
      303,
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
    return Response.redirect(
      buildSignupUrl(request, callbackUrl, result.message),
      303,
    );
  }

  await createSessionForUser(result.user.id);

  return Response.redirect(new URL(callbackUrl, getRequestOrigin(request)), 303);
}
