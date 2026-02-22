import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";
import { getBridgeStatus, retryDeadLetters } from "@/lib/viber/bridge";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  const status = getBridgeStatus();
  return Response.json(status, withObservabilityHeaders({ status: 200 }, requestId));
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const body = await request.json();

    if (body.action === "retry") {
      const result = await retryDeadLetters();
      return Response.json(result, withObservabilityHeaders({ status: 200 }, requestId));
    }

    return Response.json(
      { error: "Unknown action" },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  } catch {
    return Response.json(
      { error: "Invalid request" },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  }
}
