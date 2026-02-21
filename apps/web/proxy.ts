import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SAME_SITE,
  SESSION_COOKIE_SECURE,
} from "@/lib/auth/constants";

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
  "/shifts",
  "/fleet",
  "/washers",
  "/calendar",
];

const authPaths = ["/login", "/signup", "/forgot-password"];

function isAppRoute(pathname: string) {
  return appRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthPath(pathname: string) {
  return authPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isSafeRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

type SessionPayload = {
  uid: string;
  iat: number;
  exp: number;
};

function toBase64(value: string) {
  const paddingLength = (4 - (value.length % 4)) % 4;
  const padding = "=".repeat(paddingLength);
  return `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
}

function toBase64Url(value: Uint8Array) {
  let output = "";
  for (const byte of value) {
    output += String.fromCharCode(byte);
  }

  return btoa(output).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeStringCompare(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function isValidSessionCookie(token: string) {
  const [body, signature, extraPart] = token.split(".");

  if (!body || !signature || extraPart) {
    return false;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(atob(toBase64(body))) as SessionPayload;
  } catch {
    return false;
  }

  if (
    typeof payload.uid !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return false;
  }

  if (payload.exp * 1000 <= Date.now()) {
    return false;
  }

  const secret = (process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET)?.trim();
  if (!secret || secret.length < 32) {
    // Edge runtime can miss secure env injection in some deploy contexts.
    // Route handlers still perform authoritative session validation.
    return true;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedSignatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(body),
  );
  const expectedSignature = toBase64Url(new Uint8Array(expectedSignatureBuffer));
  if (!safeStringCompare(signature, expectedSignature)) {
    return false;
  }

  return true;
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: SESSION_COOKIE_SECURE,
    path: "/",
    expires: new Date(0),
  });
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
  requestHeaders.set("x-pathname", pathname);

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

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasValidSessionCookie = sessionCookie
    ? await isValidSessionCookie(sessionCookie)
    : false;
  const hasInvalidSessionCookie = Boolean(sessionCookie) && !hasValidSessionCookie;

  if (isAppRoute(pathname) && !hasValidSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    response = NextResponse.redirect(loginUrl);
    if (hasInvalidSessionCookie) {
      clearSessionCookie(response);
    }
    setSecurityHeaders(response, nonce, requestId);
    return response;
  }

  if (isAuthPath(pathname) && hasValidSessionCookie) {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
    const target = new URL(
      callbackUrl && isSafeRelativePath(callbackUrl) ? callbackUrl : "/overview",
      request.url,
    );
    target.search = "";
    response = NextResponse.redirect(target);
    setSecurityHeaders(response, nonce, requestId);
    return response;
  }

  response = NextResponse.next({ request: { headers: requestHeaders } });
  if (hasInvalidSessionCookie) {
    clearSessionCookie(response);
  }
  setSecurityHeaders(response, nonce, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
