import { apiError, apiSuccess } from "@/lib/api-result";
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

    const samlConfig = {
      entityId: process.env.SAML_ENTITY_ID,
      ssoUrl: process.env.SAML_SSO_URL,
      certPem: process.env.SAML_CERT_PEM,
    };

    const missing = Object.entries(samlConfig)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    return apiSuccess(
      {
        configured: missing.length === 0,
        missing,
        mode: "saml",
      },
      { requestId, status: missing.length === 0 ? 200 : 503 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "SAML_STATUS_FAILED",
      message: error instanceof Error ? error.message : "Failed to read SAML status.",
      status: 500,
    });
  }
}
