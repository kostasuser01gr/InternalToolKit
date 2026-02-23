import { getServerEnv } from "@/lib/env";
import { isDatabaseConnectivityError } from "@/lib/db-failover";

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

export async function GET() {
  try {
    getServerEnv();

    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;

    return Response.json({ ok: true, db: "ok" });
  } catch (error) {
    const errorCode = toErrorCode(error);
    const status = errorCode === "DB_UNREACHABLE" ? 503 : 500;

    return Response.json(
      { ok: false, errorCode, hint: error instanceof Error ? error.message.slice(0, 200) : undefined },
      {
        status,
      },
    );
  }
}
