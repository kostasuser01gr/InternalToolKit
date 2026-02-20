import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function toErrorCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "HEALTH_UNKNOWN_ERROR";
  }

  if (error.message.includes("SESSION_SECRET")) {
    return "ENV_SESSION_SECRET_INVALID";
  }

  if (error.message.includes("DATABASE_URL")) {
    return "ENV_DATABASE_URL_INVALID";
  }

  if (error.message.includes("DIRECT_URL")) {
    return "ENV_DIRECT_URL_INVALID";
  }

  if (
    /(can't reach database server|econnrefused|econnreset|timed out|p1001|invalid url)/i.test(
      error.message,
    )
  ) {
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
      { ok: false, errorCode },
      {
        status,
      },
    );
  }
}
