export function getRequestId(request: Request) {
  const header = request.headers.get("x-request-id")?.trim();
  if (header) {
    return header;
  }

  return crypto.randomUUID();
}

export function createErrorId() {
  return crypto.randomUUID().slice(0, 12);
}

export function withObservabilityHeaders(
  init: ResponseInit,
  requestId: string,
  errorId?: string,
) {
  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", requestId);

  if (errorId) {
    headers.set("X-Error-Id", errorId);
  }

  return {
    ...init,
    headers,
  } satisfies ResponseInit;
}

export function logWebRequest(input: {
  event: string;
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  userId?: string;
  errorId?: string;
  details?: Record<string, unknown>;
}) {
  console.info(
    JSON.stringify({
      event: input.event,
      requestId: input.requestId,
      route: input.route,
      method: input.method,
      status: input.status,
      durationMs: input.durationMs,
      userId: input.userId,
      errorId: input.errorId,
      ...(input.details ?? {}),
    }),
  );
}
