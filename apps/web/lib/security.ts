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

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
