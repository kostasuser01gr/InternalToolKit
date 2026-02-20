import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";

const DAILY_REQUEST_LIMIT = 20_000;
const DAILY_TOKEN_LIMIT = 5_000_000;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const { user, workspace } = await getAppContext(workspaceId);
    const windowDate = new Date();
    windowDate.setUTCHours(0, 0, 0, 0);

    const usage = await db.aiUsageMeter.aggregate({
      where: {
        workspaceId: workspace.id,
        userId: user.id,
        windowDate,
      },
      _sum: {
        requestsUsed: true,
        tokensUsed: true,
      },
    });

    return Response.json({
      ok: true,
      mode: "free-only",
      providers: ["free-cloud-primary", "free-cloud-secondary", "mock-fallback"],
      usage: {
        requestsUsed: usage._sum.requestsUsed ?? 0,
        requestsLimit: DAILY_REQUEST_LIMIT,
        tokensUsed: usage._sum.tokensUsed ?? 0,
        tokensLimit: DAILY_TOKEN_LIMIT,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
