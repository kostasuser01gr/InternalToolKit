import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";
import { fetchWeather, DEFAULT_STATIONS } from "@/lib/weather/client";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const stationId = url.searchParams.get("station") ?? "default";
  const lat = url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : undefined;
  const lon = url.searchParams.get("lon") ? Number(url.searchParams.get("lon")) : undefined;

  try {
    const data = await fetchWeather(stationId, lat, lon);
    return Response.json(data, withObservabilityHeaders({ status: 200 }, requestId));
  } catch {
    // Fallback: return empty weather with error flag
    return Response.json(
      {
        error: "Weather service temporarily unavailable",
        stations: Object.keys(DEFAULT_STATIONS),
      },
      withObservabilityHeaders({ status: 503 }, requestId),
    );
  }
}
