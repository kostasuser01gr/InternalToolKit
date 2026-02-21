import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PROTECTED_PREFIXES = [
  "/overview",
  "/home",
  "/chat",
  "/automations",
  "/settings",
  "/data",
  "/shifts",
  "/fleet",
  "/washers",
  "/calendar",
  "/notifications",
  "/reports",
  "/admin",
];

const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSafeRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath(pathname) && hasSessionCookie) {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
    const target = request.nextUrl.clone();
    target.pathname =
      callbackUrl && isSafeRelativePath(callbackUrl)
        ? callbackUrl
        : "/overview";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|api/).*)",
  ],
};
