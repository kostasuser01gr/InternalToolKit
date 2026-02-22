import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";

  const value = process.env[key];
  if (!value) {
    return Response.json(
      { ok: false, message: `${key} is not set` },
      withObservabilityHeaders({ status: 200 }, requestId),
    );
  }

  // Test Viber tokens by calling account info
  if (key === "VIBER_BOT_TOKEN" || key === "VIBER_CHANNEL_AUTH_TOKEN") {
    try {
      const res = await fetch("https://chatapi.viber.com/pa/get_account_info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Viber-Auth-Token": value,
        },
        body: "{}",
      });
      const data = await res.json();
      if (data.status === 0) {
        return Response.json(
          { ok: true, message: `Connected: ${data.name ?? "OK"}` },
          withObservabilityHeaders({ status: 200 }, requestId),
        );
      }
      return Response.json(
        { ok: false, message: `Viber error: ${data.status_message ?? data.status}` },
        withObservabilityHeaders({ status: 200 }, requestId),
      );
    } catch (err) {
      return Response.json(
        { ok: false, message: `Connection failed: ${err instanceof Error ? err.message : "unknown"}` },
        withObservabilityHeaders({ status: 200 }, requestId),
      );
    }
  }

  // Generic: just confirm the env var is set
  return Response.json(
    { ok: true, message: `${key} is configured (${value.length} chars)` },
    withObservabilityHeaders({ status: 200 }, requestId),
  );
}
