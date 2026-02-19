export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>,
) {
  const payload = {
    event,
    occurredAt: new Date().toISOString(),
    ...details,
  };

  console.info("[security]", JSON.stringify(payload));
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstHop = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);

    if (firstHop) {
      return firstHop;
    }
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function getClientDeviceId(request: Request) {
  const explicit = request.headers.get("x-device-id")?.trim();
  if (explicit) {
    return explicit;
  }

  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
  const language = request.headers.get("accept-language")?.trim() || "unknown";
  const digest = `${userAgent}|${language}`.slice(0, 180);
  return digest;
}

export function isSameOriginRequest(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!host) {
    return false;
  }

  const candidates = [
    request.headers.get("origin"),
    request.headers.get("referer"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (new URL(candidate).host === host) {
        return true;
      }
    } catch {
      continue;
    }
  }

  if (candidates.length > 0) {
    return false;
  }

  // Browser POSTs include Origin (or Referer). For local non-browser tooling
  // we keep development ergonomics by allowing missing origin metadata in dev.
  return process.env.NODE_ENV !== "production";
}
