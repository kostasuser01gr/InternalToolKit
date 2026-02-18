import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const appRoutes = [
  "/home",
  "/overview",
  "/dashboard",
  "/data",
  "/automations",
  "/assistant",
  "/chat",
  "/analytics",
  "/controls",
  "/activity",
  "/reports",
  "/components",
  "/notifications",
  "/settings",
  "/admin",
];

function isAppRoute(pathname: string) {
  return appRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildCsp(nonce: string, isDevelopment: boolean) {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ];

  const connectSources = [
    "'self'",
    "https:",
    ...(isDevelopment ? ["http:", "ws:", "wss:"] : []),
  ];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`,
    `connect-src ${connectSources.join(" ")}`,
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

function setSecurityHeaders(response: NextResponse, nonce: string, requestId: string) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  response.headers.set("Content-Security-Policy", buildCsp(nonce, isDevelopment));
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-CSP-Nonce", nonce);
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const nonce = createNonce();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);

  const pathname = request.nextUrl.pathname;

  let response: NextResponse;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/session") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
    setSecurityHeaders(response, nonce, requestId);
    return response;
  }

  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (isAppRoute(pathname) && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    response = NextResponse.redirect(loginUrl);
    setSecurityHeaders(response, nonce, requestId);
    return response;
  }

  if (pathname === "/login" && hasSessionCookie) {
    response = NextResponse.redirect(new URL("/overview", request.url));
    setSecurityHeaders(response, nonce, requestId);
    return response;
  }

  response = NextResponse.next({ request: { headers: requestHeaders } });
  setSecurityHeaders(response, nonce, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};

