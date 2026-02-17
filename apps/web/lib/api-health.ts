import { healthResponseSchema, type HealthResponse } from "@internal-toolkit/shared";

const defaultApiUrl = "http://127.0.0.1:8787";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || defaultApiUrl;
}

export async function fetchApiHealth(): Promise<HealthResponse | null> {
  const apiBaseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return healthResponseSchema.parse(payload);
  } catch {
    return null;
  }
}
