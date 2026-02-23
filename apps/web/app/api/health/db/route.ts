import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, string> = {};
  const missingEnv: string[] = [];

  // Check required env var names (never values)
  for (const key of ["DATABASE_URL", "DIRECT_URL", "SESSION_SECRET", "CRON_SECRET"]) {
    if (!process.env[key]) missingEnv.push(key);
  }

  // Check Convex connectivity
  try {
    const { getConvexClient } = await import("@/lib/convex-client");
    const convex = getConvexClient();
    if (convex) {
      const { api } = await import("@/lib/convex-api");
      await convex.query(api.users.getByEmail, { email: "__health_check__" });
      results.convex = "ok";
    } else {
      results.convex = "not_configured";
    }
  } catch {
    results.convex = "error";
  }

  // Check Prisma/DB connectivity
  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1 AS ok`;
    results.prisma = "ok";
  } catch (error) {
    results.prisma = isDatabaseUnavailableError(error) ? "unreachable" : "error";
  }

  const ok = results.convex === "ok" || results.prisma === "ok";

  return Response.json(
    { ok, backends: results, missingEnv: missingEnv.length > 0 ? missingEnv : undefined },
    { status: ok ? 200 : 503 },
  );
}
