import {
  aiChatChunkSchema,
  aiChatRequestSchema,
  aiChatResponseSchema,
} from "@internal-toolkit/shared";

import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

const DEFAULT_MODEL_ID = "free-cloud-primary:v1";

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function bumpUsage(input: {
  workspaceId: string;
  userId: string;
  provider: string;
  tokens: number;
}) {
  const windowDate = new Date();
  windowDate.setUTCHours(0, 0, 0, 0);

  await db.aiUsageMeter.upsert({
    where: {
      workspaceId_userId_windowDate_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        windowDate,
        provider: input.provider,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      windowDate,
      provider: input.provider,
      requestsUsed: 1,
      tokensUsed: input.tokens,
    },
    update: {
      requestsUsed: {
        increment: 1,
      },
      tokensUsed: {
        increment: input.tokens,
      },
    },
  });
}

function buildContent(prompt: string, task?: string) {
  if (task === "automation_draft") {
    return JSON.stringify(
      {
        trigger: { type: "record.updated", table: "Incidents" },
        actions: [
          { type: "create_notification", title: "Incident updated" },
          { type: "write_audit_log", action: "automation.generated" },
        ],
        notes: prompt,
      },
      null,
      2,
    );
  }

  if (task === "kpi_layout") {
    return "KPI layout suggestion: top KPI row, trend middle row, action backlog and incidents in bottom row.";
  }

  return `Cloud-free response: ${prompt}`;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const { user, workspace } = await getAppContext();
    const payload = aiChatRequestSchema.parse(await request.json());
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const provider =
      env.AI_PROVIDER_MODE === "mock" ? "mock-fallback" : "free-cloud-primary";
    const modelId = payload.modelId?.trim() || DEFAULT_MODEL_ID;
    const content = buildContent(payload.prompt, payload.task);
    const tokenUsage = estimateTokens(`${payload.prompt}\n${content}`);
    const latencyMs = Date.now() - startedAt;

    await bumpUsage({
      workspaceId: workspace.id,
      userId: user.id,
      provider,
      tokens: tokenUsage,
    });

    if (payload.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const chunkSize = 48;
          for (let index = 0; index < content.length; index += chunkSize) {
            const delta = content.slice(index, index + chunkSize);
            const chunk = aiChatChunkSchema.parse({
              provider,
              requestId,
              delta,
              done: false,
              modelId,
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          const doneChunk = aiChatChunkSchema.parse({
            provider,
            requestId,
            delta: "",
            done: true,
            modelId,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "keep-alive",
        },
      });
    }

    const response = aiChatResponseSchema.parse({
      ok: true,
      provider,
      modelId,
      requestId,
      latencyMs,
      content,
      usage: {
        requestsUsed: 1,
        requestsLimit: 20_000,
        tokensUsed: tokenUsage,
        tokensLimit: 5_000_000,
      },
    });

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
