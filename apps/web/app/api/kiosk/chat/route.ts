import { z } from "zod";

import { db } from "@/lib/db";
import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest, logSecurityEvent } from "@/lib/security";

const KIOSK_TOKEN = process.env.KIOSK_TOKEN ?? "";
const WASHERS_CHANNEL_SLUG = "washers-only";

const sendMessageSchema = z.object({
  workspaceId: z.string().min(1),
  deviceId: z.string().min(1).max(120),
  stationId: z.string().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
  voiceTranscript: z.string().trim().max(2000).optional(),
});

function validateKioskToken(request: Request): boolean {
  if (!KIOSK_TOKEN) return false;
  const header = request.headers.get("x-kiosk-token");
  if (!header) return false;
  if (header.length !== KIOSK_TOKEN.length) return false;
  let result = 0;
  for (let i = 0; i < header.length; i++) {
    result |= header.charCodeAt(i) ^ KIOSK_TOKEN.charCodeAt(i);
  }
  return result === 0;
}

async function ensureWashersChannel(workspaceId: string) {
  const existing = await db.chatChannel.findFirst({
    where: { workspaceId, slug: WASHERS_CHANNEL_SLUG },
  });
  if (existing) return existing;

  return db.chatChannel.create({
    data: {
      workspaceId,
      name: "#washers-only",
      slug: WASHERS_CHANNEL_SLUG,
      type: "PUBLIC",
      description: "Internal channel for washer communications. Posts from kiosk devices appear here.",
      isReadOnly: false,
      isArchived: false,
    },
  });
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  if (!validateKioskToken(request)) {
    return Response.json(
      { error: "Invalid kiosk token" },
      withObservabilityHeaders({ status: 401 }, requestId),
    );
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return Response.json(
      { error: "workspaceId required" },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  }

  try {
    const channel = await ensureWashersChannel(workspaceId);

    const threads = await db.chatThread.findMany({
      where: { channelId: channel.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });

    return Response.json(
      {
        channelId: channel.id,
        channelName: channel.name,
        threads: threads.map((t) => ({
          id: t.id,
          title: t.title,
          updatedAt: t.updatedAt,
          messages: t.messages.map((m) => ({
            id: m.id,
            content: m.content,
            authorName: m.author?.name ?? "Kiosk User",
            createdAt: m.createdAt,
          })),
        })),
      },
      withObservabilityHeaders({ status: 200 }, requestId),
    );
  } catch {
    return Response.json(
      { error: "Failed to load chat" },
      withObservabilityHeaders({ status: 500 }, requestId),
    );
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  if (!isSameOriginRequest(request)) {
    logSecurityEvent("kiosk-chat-cross-origin", { requestId });
  }

  if (!validateKioskToken(request)) {
    return Response.json(
      { error: "Invalid kiosk token", readOnly: true },
      withObservabilityHeaders({ status: 401 }, requestId),
    );
  }

  const rateLimitKey = `kiosk-chat:${request.headers.get("x-device-id") ?? "unknown"}`;
  const rateResult = checkRateLimit({ key: rateLimitKey, limit: 30, windowMs: 60_000 });
  if (!rateResult.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      withObservabilityHeaders({ status: 429 }, requestId),
    );
  }

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.parse(body);

    const channel = await ensureWashersChannel(parsed.workspaceId);

    const today = new Date().toISOString().slice(0, 10);
    const threadTitle = `Kiosk Chat — ${today}`;

    // For kiosk, use the workspace owner as thread creator
    const wsOwner = await db.workspaceMember.findFirst({
      where: { workspaceId: parsed.workspaceId, role: "ADMIN" },
      select: { userId: true },
    });
    const creatorId = wsOwner?.userId ?? "system";

    let thread = await db.chatThread.findFirst({
      where: {
        channelId: channel.id,
        title: threadTitle,
      },
    });

    if (!thread) {
      thread = await db.chatThread.create({
        data: {
          workspaceId: parsed.workspaceId,
          channelId: channel.id,
          title: threadTitle,
          createdBy: creatorId,
        },
      });
    }

    const message = await db.chatMessage.create({
      data: {
        threadId: thread.id,
        content: `[Kiosk ${parsed.stationId}/${parsed.deviceId.slice(0, 8)}] ${parsed.content}`,
        role: "USER",
      },
    });

    await db.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    return Response.json(
      {
        success: true,
        messageId: message.id,
        threadId: thread.id,
        channelId: channel.id,
      },
      withObservabilityHeaders({ status: 200 }, requestId),
    );
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map((i) => i.message).join(", ") : "Failed to send message";
    return Response.json(
      { error: msg },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  }
}
