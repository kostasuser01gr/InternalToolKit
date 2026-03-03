import { apiError, apiSuccess } from "@/lib/api-result";
import { MODULE_BACKEND_DECISIONS } from "@/lib/backend-decision";
import { getMigrationGateStatus } from "@/lib/migration-gate";
import { getRequestId } from "@/lib/http-observability";
import { db } from "@/lib/db";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/lib/convex-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const deps: {
      db: "ok" | "error";
      convex: "ok" | "not_configured" | "error";
      cron: "ok" | "degraded" | "error";
      feeds: "ok" | "degraded" | "error";
      ai: "cloud_free" | "mock" | "router" | "error";
      integrations: "ok" | "degraded";
    } = {
      db: "error",
      convex: "not_configured",
      cron: "error",
      feeds: "error",
      ai: "error",
      integrations: "degraded",
    };

    try {
      await db.$queryRaw`SELECT 1`;
      deps.db = "ok";
    } catch {
      deps.db = "error";
    }

    try {
      const convex = getConvexClient();
      if (convex) {
        await convex.query(api.users.getByEmail, { email: "__health_check__" });
        deps.convex = "ok";
      }
    } catch {
      deps.convex = "error";
    }

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failures = await db.cronRun.count({
        where: {
          createdAt: { gte: since },
          status: { in: ["error", "failed"] },
        },
      });
      deps.cron = failures === 0 ? "ok" : "degraded";
    } catch {
      deps.cron = "error";
    }

    try {
      const activeSources = await db.feedSource.count({ where: { isActive: true } });
      const staleSources = await db.feedSource.count({
        where: {
          isActive: true,
          OR: [
            { lastScannedAt: null },
            { lastScannedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
          ],
        },
      });

      if (activeSources === 0) {
        deps.feeds = "degraded";
      } else {
        deps.feeds = staleSources > 0 ? "degraded" : "ok";
      }
    } catch {
      deps.feeds = "error";
    }

    try {
      if (process.env.OPENROUTER_API_KEY) {
        deps.ai = "router";
      } else if ((process.env.AI_PROVIDER_MODE ?? "cloud_free") === "mock") {
        deps.ai = "mock";
      } else {
        deps.ai = "cloud_free";
      }
    } catch {
      deps.ai = "error";
    }

    const requiredIntegrationKeys = [
      "DATABASE_URL",
      "SESSION_SECRET",
      "CRON_SECRET",
      "VIBER_CHANNEL_AUTH_TOKEN",
    ];
    const missing = requiredIntegrationKeys.filter((key) => !process.env[key]);
    deps.integrations = missing.length === 0 ? "ok" : "degraded";

    const migrationGate = await getMigrationGateStatus();

    const status =
      deps.db === "ok" &&
      deps.cron !== "error" &&
      deps.feeds !== "error" &&
      migrationGate.ok;

    if (!status) {
      return apiError({
        requestId,
        code: "DEPENDENCIES_DEGRADED",
        message: "One or more dependencies are degraded.",
        status: 503,
      });
    }

    return apiSuccess(
      {
        dependencies: deps,
        backendDecisions: Object.values(MODULE_BACKEND_DECISIONS),
        migrationGate,
        missingIntegrations: missing,
        checkedAt: new Date().toISOString(),
      },
      { requestId, status: 200 },
    );
  } catch {
    return apiError({
      requestId,
      code: "DEPENDENCIES_CHECK_FAILED",
      message: "Failed to check dependency health.",
      status: 500,
    });
  }
}
