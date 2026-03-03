import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-result";
import { db } from "@/lib/db";
import { getRequestId } from "@/lib/http-observability";
import { requireWorkspaceRole } from "@/lib/rbac";

const querySchema = z.object({
  workspaceId: z.string().min(1),
  hours: z.coerce.number().int().min(1).max(24 * 14).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? "",
    hours: searchParams.get("hours") ?? undefined,
  });

  if (!parsed.success) {
    return apiError({ requestId, code: "VALIDATION_ERROR", message: "Invalid query.", status: 400 });
  }

  try {
    await requireWorkspaceRole(parsed.data.workspaceId, ["ADMIN", "EDITOR"]);

    const since = new Date(Date.now() - (parsed.data.hours ?? 48) * 60 * 60 * 1000);

    const [failedRuns, allRuns, openDeadLetters] = await Promise.all([
      db.cronRun.findMany({
        where: {
          createdAt: { gte: since },
          status: { in: ["error", "failed"] },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.cronRun.findMany({
        where: {
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.deadLetterEntry.findMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          resolvedAt: null,
          ignoredAt: null,
        },
        orderBy: { lastAttempt: "desc" },
        take: 200,
      }),
    ]);

    const byJob = new Map<string, { total: number; failures: number; lastFailureAt?: string }>();
    for (const run of allRuns) {
      const existing = byJob.get(run.job) ?? { total: 0, failures: 0 };
      existing.total += 1;
      if (["error", "failed"].includes(run.status)) {
        existing.failures += 1;
        if (!existing.lastFailureAt || run.createdAt.toISOString() > existing.lastFailureAt) {
          existing.lastFailureAt = run.createdAt.toISOString();
        }
      }
      byJob.set(run.job, existing);
    }

    return apiSuccess(
      {
        periodStart: since.toISOString(),
        failedRuns,
        jobs: [...byJob.entries()].map(([job, stats]) => ({
          job,
          totalRuns: stats.total,
          failedRuns: stats.failures,
          failureRate: stats.total > 0 ? Number((stats.failures / stats.total).toFixed(3)) : 0,
          lastFailureAt: stats.lastFailureAt ?? null,
        })),
        deadLetter: {
          open: openDeadLetters.length,
          items: openDeadLetters,
        },
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return apiError({
      requestId,
      code: "CRON_FAILURE_DASHBOARD_FAILED",
      message: error instanceof Error ? error.message : "Failed to load cron failure dashboard.",
      status: 500,
    });
  }
}
