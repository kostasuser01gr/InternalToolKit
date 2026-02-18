import type { HealthResponse } from "@internal-toolkit/shared";

import { fetchHealth, getApiBaseUrl } from "@/lib/api/client";

export { getApiBaseUrl };

export async function fetchApiHealth(): Promise<HealthResponse | null> {
  return fetchHealth();
}
