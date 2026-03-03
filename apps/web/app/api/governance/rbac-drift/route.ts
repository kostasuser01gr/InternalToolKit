import { apiError, apiSuccess } from "@/lib/api-result";
import { getRbacDriftStatus } from "@/lib/governance/rbac-drift";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";

  if (!workspaceId) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "workspaceId is required.", status: 400 });
  }

  try {
    await requireWorkspaceRole(workspaceId, ["ADMIN"]);

    const status = getRbacDriftStatus();

    return apiSuccess(
      {
        ...status,
        checkedAt: new Date().toISOString(),
      },
      { requestId, status: status.driftDetected ? 409 : 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "RBAC_DRIFT_CHECK_FAILED",
      message: error instanceof Error ? error.message : "Failed to check RBAC drift.",
      status: 500,
    });
  }
}
