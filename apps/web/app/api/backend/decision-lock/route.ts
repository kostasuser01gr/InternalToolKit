import { apiError, apiSuccess } from "@/lib/api-result";
import { MODULE_BACKEND_DECISIONS } from "@/lib/backend-decision";
import { getRequestId } from "@/lib/http-observability";
import { getMigrationGateStatus } from "@/lib/migration-gate";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const migrationGate = await getMigrationGateStatus();

    return apiSuccess(
      {
        lockedModules: Object.values(MODULE_BACKEND_DECISIONS),
        migrationGate,
      },
      { requestId, status: migrationGate.ok ? 200 : 503 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "BACKEND_DECISION_LOCK_FAILED",
      message: error instanceof Error ? error.message : "Failed to load backend decision lock.",
      status: 500,
    });
  }
}
