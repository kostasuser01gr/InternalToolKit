import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { createSessionForUser, verifyCredentials } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/security";
import { getDefaultWorkspaceForUser } from "@/lib/workspace";

const formSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
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

  const formData = await request.formData();
  const parsed = formSchema.safeParse({
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

  const ip = request.headers.get("x-forwarded-for") ?? undefined;
  const result = await verifyCredentials({
    email: parsed.data.email,
    password: parsed.data.password,
    ...(ip ? { ip } : {}),
  });

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
