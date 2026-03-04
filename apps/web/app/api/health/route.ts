import { getServerEnv } from "@/lib/env";
import { isDatabaseConnectivityError } from "@/lib/db-failover";
import {
  createErrorId,
  getRequestId,
  logWebRequest,
  withObservabilityHeaders,
} from "@/lib/http-observability";

export const dynamic = "force-dynamic";

function toErrorCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "HEALTH_UNKNOWN_ERROR";
  }

  const missingKeysMatch = error.message.match(
    /Missing required env keys:\s*([^\n.]+)/i,
  );
  const missingKeys = (missingKeysMatch?.[1] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    missingKeys.includes("SESSION_SECRET") ||
    /SESSION_SECRET must|NEXTAUTH_SECRET must/i.test(error.message)
  ) {
    return "ENV_SESSION_SECRET_INVALID";
  }

  if (
    missingKeys.includes("DATABASE_URL") ||
    /DATABASE_URL must/i.test(error.message)
  ) {
    return "ENV_DATABASE_URL_INVALID";
  }

  if (
    missingKeys.includes("DIRECT_URL") ||
    /DIRECT_URL must/i.test(error.message)
  ) {
    return "ENV_DIRECT_URL_INVALID";
  }

  if (isDatabaseConnectivityError(error)) {
    return "DB_UNREACHABLE";
  }

  return "HEALTH_CHECK_FAILED";
}

type HealthDependencyState =
  | "ok"
  | "degraded"
  | "error"
  | "not_configured"
  | "cloud_free"
  | "mock"
  | "router";

type HealthDependencies = {
  env: HealthDependencyState;
  db: HealthDependencyState;
  convex: HealthDependencyState;
  cron: HealthDependencyState;
  feeds: HealthDependencyState;
  ai: HealthDependencyState;
  integrations: HealthDependencyState;
};

type DbClient = (typeof import("@/lib/db"))["db"];

function initialDependencies(): HealthDependencies {
  return {
    env: "ok",
    db: "error",
    convex: "not_configured",
    cron: "degraded",
    feeds: "degraded",
    ai: "cloud_free",
    integrations: "degraded",
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const timestamp = new Date().toISOString();
  const dependencies = initialDependencies();
  const notes: string[] = [];

  try {
    getServerEnv();
    dependencies.env = "ok";
  } catch (error) {
    dependencies.env = "degraded";
    const message = error instanceof Error ? error.message : "Invalid environment configuration.";
    const shortMessage = message.split("\n")[0] ?? "Invalid environment configuration.";
    notes.push(shortMessage);
  }

  let dbClient: DbClient | null = null;
  try {
    const { db } = await import("@/lib/db");
    dbClient = db;
    await db.$queryRaw`SELECT 1`;
    dependencies.db = "ok";
  } catch (error) {
    dependencies.db = "error";
    const message = error instanceof Error ? error.message : "Database connectivity failed.";
    notes.push(message.split("\n")[0] ?? "Database connectivity failed.");
  }

  try {
    const { getConvexClient } = await import("@/lib/convex-client");
    const convex = getConvexClient();
    if (convex) {
      const { api } = await import("@/lib/convex-api");
      await convex.query(api.users.getByEmail, { email: "__health_check__" });
      dependencies.convex = "ok";
    } else {
      dependencies.convex = "not_configured";
    }
  } catch (error) {
    dependencies.convex = "degraded";
    const message = error instanceof Error ? error.message : "Convex connectivity failed.";
    notes.push(message.split("\n")[0] ?? "Convex connectivity failed.");
  }

  if (dbClient) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failures = await dbClient.cronRun.count({
        where: { createdAt: { gte: since }, status: { in: ["error", "failed"] } },
      });
      dependencies.cron = failures === 0 ? "ok" : "degraded";
    } catch {
      dependencies.cron = "error";
    }

    try {
      const activeSources = await dbClient.feedSource.count({ where: { isActive: true } });
      const staleSources = await dbClient.feedSource.count({
        where: {
          isActive: true,
          OR: [
            { lastScannedAt: null },
            { lastScannedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
          ],
        },
      });
      dependencies.feeds = activeSources === 0 || staleSources > 0 ? "degraded" : "ok";
    } catch {
      dependencies.feeds = "error";
    }
  } else {
    dependencies.cron = "error";
    dependencies.feeds = "error";
  }

  if (process.env.OPENROUTER_API_KEY) {
    dependencies.ai = "router";
  } else if ((process.env.AI_PROVIDER_MODE ?? "cloud_free") === "mock") {
    dependencies.ai = "mock";
  } else {
    dependencies.ai = "cloud_free";
  }

  const requiredIntegrationKeys = ["DATABASE_URL", "SESSION_SECRET", "DIRECT_URL", "CRON_SECRET"];
  const missingIntegrations = requiredIntegrationKeys.filter((key) => !process.env[key]);
  dependencies.integrations = missingIntegrations.length === 0 ? "ok" : "degraded";

  if (missingIntegrations.length > 0) {
    notes.push(`Missing required env keys: ${missingIntegrations.join(", ")}`);
  }

  const isHealthy = dependencies.env === "ok" && dependencies.db === "ok";
  const status = isHealthy ? "ok" : "degraded";
  const errorCode = isHealthy
    ? null
    : toErrorCode(new Error(notes[0] ?? "Health checks degraded."));
  const errorId = isHealthy ? undefined : createErrorId();

  logWebRequest({
    event: "health.check",
    requestId,
    route: "/api/health",
    method: "GET",
    status: 200,
    durationMs: Date.now() - startedAt,
    ...(errorId ? { errorId } : {}),
    details: {
      status,
      env: dependencies.env,
      db: dependencies.db,
      convex: dependencies.convex,
    },
  });

  return Response.json(
    {
      ok: isHealthy,
      status,
      timestamp,
      db: dependencies.db === "ok" ? "prisma" : "unavailable",
      dependencies,
      ...(isHealthy
        ? {}
        : {
            error: {
              code: errorCode ?? "HEALTH_CHECK_FAILED",
              message: notes[0] ?? "Service dependencies are degraded.",
              requestId,
              ...(errorId ? { errorId } : {}),
            },
          }),
    },
    withObservabilityHeaders({ status: 200 }, requestId, errorId),
  );
}
