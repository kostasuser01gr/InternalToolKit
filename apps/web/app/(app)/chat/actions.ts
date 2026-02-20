"use server";

import {
  ChatArtifactType,
  ChatRole,
  ShiftStatus,
  VehicleEventType,
  WorkspaceRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { getAssistantProvider } from "@/lib/assistant/provider";
import {
  generateAutomationDraft,
  generateKpiLayoutSuggestion,
  summarizeRecords,
} from "@/lib/assistant/service";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspaceRole } from "@/lib/rbac";
import {
  convertMessageSchema,
  createThreadSchema,
  exportMessageSchema,
  forkThreadSchema,
  pinMessageSchema,
  regenerateMessageSchema,
  sendMessageSchema,
} from "@/lib/validators/chat";

const DEFAULT_MODEL_ID = "free-cloud-primary:v1";
const SUMMARY_SAMPLE_LIMIT = 120;

function buildChatUrl(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `/chat?${queryString}` : "/chat";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

function estimateTokens(input: string) {
  return Math.max(1, Math.ceil(input.length / 4));
}

async function bumpUsageMeter(input: {
  workspaceId: string;
  userId: string;
  provider: string;
  tokenUsage: number;
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
      tokensUsed: input.tokenUsage,
    },
    update: {
      requestsUsed: {
        increment: 1,
      },
      tokensUsed: {
        increment: input.tokenUsage,
      },
    },
  });
}

async function runSlashCommand(input: {
  workspaceId: string;
  userId: string;
  content: string;
}) {
  const [command, ...restParts] = input.content.trim().split(/\s+/);
  const rest = restParts.join(" ").trim();
  const commandName = (command ?? "").toLowerCase();

  if (!commandName) {
    return {
      provider: "mock-fallback",
      modelId: DEFAULT_MODEL_ID,
      commandName,
      content: "Command cannot be empty.",
    };
  }

  if (commandName === "/summarize-table") {
    const [tableNameRaw, filterRaw] = rest.split("|").map((part) => part.trim());
    const tableName = tableNameRaw || "";
    const filterText = filterRaw || undefined;

    const table = tableName
      ? await db.table.findFirst({
          where: {
            workspaceId: input.workspaceId,
            name: {
              contains: tableName,
              mode: "insensitive",
            },
          },
        })
      : await db.table.findFirst({
          where: {
            workspaceId: input.workspaceId,
          },
          orderBy: { name: "asc" },
        });

    if (!table) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content: "Unable to summarize: no table found for this workspace.",
      };
    }

    const normalizedFilter = filterText?.trim().toLowerCase();
    const where = {
      tableId: table.id,
      ...(normalizedFilter
        ? { searchText: { contains: normalizedFilter } }
        : {}),
    };
    const totalMatchingRecords = await db.record.count({ where });
    const records = await db.record.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: SUMMARY_SAMPLE_LIMIT,
      select: {
        dataJson: true,
      },
    });
    const result = await summarizeRecords(records, filterText, {
      totalMatchingRecords,
    });

    return {
      provider: result.provider,
      modelId: DEFAULT_MODEL_ID,
      commandName,
      content: result.content,
    };
  }

  if (commandName === "/draft-automation") {
    if (!rest) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content:
          "Usage: /draft-automation <prompt>. Example: /draft-automation Alert ops when priority incidents are created.",
      };
    }

    const result = await generateAutomationDraft(rest);
    return {
      provider: result.provider,
      modelId: DEFAULT_MODEL_ID,
      commandName,
      content: result.content,
    };
  }

  if (commandName === "/kpi-layout") {
    if (!rest) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content:
          "Usage: /kpi-layout <objective>. Example: /kpi-layout Throughput, quality, and SLA risk dashboard.",
      };
    }

    const result = await generateKpiLayoutSuggestion(rest);
    return {
      provider: result.provider,
      modelId: DEFAULT_MODEL_ID,
      commandName,
      content: result.content,
    };
  }

  if (commandName === "/create-shift") {
    const [title, startsAtRaw, endsAtRaw] = rest
      .split("|")
      .map((part) => part.trim());
    if (!title || !startsAtRaw || !endsAtRaw) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content:
          "Usage: /create-shift <title>|<startsAt ISO>|<endsAt ISO>. Example: /create-shift Night On-call|2026-02-21T20:00:00.000Z|2026-02-22T04:00:00.000Z",
      };
    }

    const startsAt = new Date(startsAtRaw);
    const endsAt = new Date(endsAtRaw);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content:
          "Invalid shift timestamps. Use ISO datetime values where end is after start.",
      };
    }

    const shift = await db.shift.create({
      data: {
        workspaceId: input.workspaceId,
        createdBy: input.userId,
        title,
        startsAt,
        endsAt,
        status: ShiftStatus.PUBLISHED,
      },
    });

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "chat.command.create_shift",
      entityType: "shift",
      entityId: shift.id,
      metaJson: {
        title,
      },
    });

    return {
      provider: "mock-fallback",
      modelId: DEFAULT_MODEL_ID,
      commandName,
      content: `Shift created: ${shift.title} (${shift.startsAt.toISOString()} -> ${shift.endsAt.toISOString()}).`,
    };
  }

  if (commandName === "/log-fleet-event") {
    const [plate, typeRaw, notes] = rest.split("|").map((part) => part.trim());
    if (!plate || !notes) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content:
          "Usage: /log-fleet-event <plate>|<eventType>|<notes>. Example: /log-fleet-event ABC123|maintenance_note|Brake check completed",
      };
    }

    const vehicle = await db.vehicle.findFirst({
      where: {
        workspaceId: input.workspaceId,
        plateNumber: {
          equals: plate,
          mode: "insensitive",
        },
      },
    });

    if (!vehicle) {
      return {
        provider: "mock-fallback",
        modelId: DEFAULT_MODEL_ID,
        commandName,
        content: `Vehicle ${plate} was not found.`,
      };
    }

    const normalizedType = (typeRaw || "status_change")
      .trim()
      .toUpperCase()
      .replace(/-/g, "_");
    const eventType = VehicleEventType[normalizedType as keyof typeof VehicleEventType]
      ? (normalizedType as VehicleEventType)
      : VehicleEventType.STATUS_CHANGE;

    const event = await db.vehicleEvent.create({
      data: {
        workspaceId: input.workspaceId,
        vehicleId: vehicle.id,
        actorUserId: input.userId,
        type: eventType,
        notes,
      },
    });

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "chat.command.log_fleet_event",
      entityType: "vehicle_event",
      entityId: event.id,
      metaJson: {
        plateNumber: vehicle.plateNumber,
        type: event.type,
      },
    });

    return {
      provider: "mock-fallback",
      modelId: DEFAULT_MODEL_ID,
      commandName,
      content: `Vehicle event logged for ${vehicle.plateNumber} (${event.type}).`,
    };
  }

  return {
    provider: "mock-fallback",
    modelId: DEFAULT_MODEL_ID,
    commandName,
    content:
      "Unknown slash command. Available: /summarize-table, /draft-automation, /kpi-layout, /create-shift, /log-fleet-event.",
  };
}

async function getAssistantReply(input: {
  workspaceId: string;
  userId: string;
  content: string;
}) {
  const startedAt = Date.now();
  const trimmed = input.content.trim();

  const result = trimmed.startsWith("/")
    ? await runSlashCommand({
        workspaceId: input.workspaceId,
        userId: input.userId,
        content: trimmed,
      })
    : await (async () => {
        const provider = getAssistantProvider();
        const response = await provider.generate({
          type: "summarize_table",
          prompt: trimmed,
        });
        return {
          provider: response.provider,
          modelId: DEFAULT_MODEL_ID,
          commandName: undefined,
          content: response.content,
        };
      })();

  const latencyMs = Date.now() - startedAt;
  const tokenUsage = estimateTokens(result.content);

  return {
    ...result,
    latencyMs,
    tokenUsage,
  };
}

export async function createThreadAction(formData: FormData) {
  const parsed = createThreadSchema.parse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);

    const thread = await db.chatThread.create({
      data: {
        workspaceId: parsed.workspaceId,
        title: parsed.title,
        createdBy: user.id,
      },
    });

    await db.chatMessage.create({
      data: {
        threadId: thread.id,
        role: ChatRole.SYSTEM,
        content: `${user.name ?? user.email ?? "User"} created this thread.`,
        modelId: DEFAULT_MODEL_ID,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.thread_created",
      entityType: "chat_thread",
      entityId: thread.id,
      metaJson: {
        title: parsed.title,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: thread.id,
        success: "Thread created.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function sendMessageAction(formData: FormData) {
  const parsed = sendMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    threadId: formData.get("threadId"),
    content: formData.get("content"),
    modelId: formData.get("modelId") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);

    const thread = await db.chatThread.findFirst({
      where: {
        id: parsed.threadId,
        workspaceId: parsed.workspaceId,
      },
    });

    if (!thread) {
      throw new Error("Thread not found.");
    }

    await db.chatMessage.create({
      data: {
        threadId: thread.id,
        authorUserId: user.id,
        role: ChatRole.USER,
        content: parsed.content,
        modelId: parsed.modelId ?? DEFAULT_MODEL_ID,
        tokenUsage: estimateTokens(parsed.content),
        status: "COMPLETED",
      },
    });

    const assistant = await getAssistantReply({
      workspaceId: parsed.workspaceId,
      userId: user.id,
      content: parsed.content,
    });

    await db.chatMessage.create({
      data: {
        threadId: thread.id,
        role: ChatRole.ASSISTANT,
        content: assistant.content,
        modelId: assistant.modelId,
        latencyMs: assistant.latencyMs,
        tokenUsage: assistant.tokenUsage,
        status: "COMPLETED",
        commandName: assistant.commandName ?? null,
      },
    });

    await bumpUsageMeter({
      workspaceId: parsed.workspaceId,
      userId: user.id,
      provider: assistant.provider,
      tokenUsage: assistant.tokenUsage,
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_sent",
      entityType: "chat_thread",
      entityId: thread.id,
      metaJson: {
        contentLength: parsed.content.length,
        provider: assistant.provider,
        latencyMs: assistant.latencyMs,
      },
    });

    revalidatePath("/chat");
    revalidatePath("/assistant");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: thread.id,
        success: `Message sent via ${assistant.provider}.`,
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function regenerateMessageAction(formData: FormData) {
  const parsed = regenerateMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    threadId: formData.get("threadId"),
    messageId: formData.get("messageId") || undefined,
    modelId: formData.get("modelId") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);

    const messages = await db.chatMessage.findMany({
      where: {
        threadId: parsed.threadId,
      },
      orderBy: [{ createdAt: "asc" }],
    });
    const anchorIndex = parsed.messageId
      ? messages.findIndex((message) => message.id === parsed.messageId)
      : messages.length - 1;
    const candidateMessages =
      anchorIndex >= 0 ? messages.slice(0, anchorIndex + 1) : messages;
    const latestUser = [...candidateMessages]
      .reverse()
      .find((message) => message.role === ChatRole.USER);

    if (!latestUser) {
      throw new Error("No user message available to regenerate from.");
    }

    const assistant = await getAssistantReply({
      workspaceId: parsed.workspaceId,
      userId: user.id,
      content: latestUser.content,
    });

    await db.chatMessage.create({
      data: {
        threadId: parsed.threadId,
        role: ChatRole.ASSISTANT,
        content: assistant.content,
        modelId: parsed.modelId ?? assistant.modelId,
        latencyMs: assistant.latencyMs,
        tokenUsage: assistant.tokenUsage,
        status: "COMPLETED",
        commandName: assistant.commandName ?? null,
      },
    });

    await bumpUsageMeter({
      workspaceId: parsed.workspaceId,
      userId: user.id,
      provider: assistant.provider,
      tokenUsage: assistant.tokenUsage,
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_regenerated",
      entityType: "chat_thread",
      entityId: parsed.threadId,
      metaJson: {
        sourceMessageId: latestUser.id,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        success: "Assistant response regenerated.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function forkThreadAction(formData: FormData) {
  const parsed = forkThreadSchema.parse({
    workspaceId: formData.get("workspaceId"),
    threadId: formData.get("threadId"),
    messageId: formData.get("messageId") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);

    const thread = await db.chatThread.findFirst({
      where: {
        id: parsed.threadId,
        workspaceId: parsed.workspaceId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!thread) {
      throw new Error("Thread not found.");
    }

    const anchorIndex = parsed.messageId
      ? thread.messages.findIndex((message) => message.id === parsed.messageId)
      : thread.messages.length - 1;
    const messagesToCopy =
      anchorIndex >= 0
        ? thread.messages.slice(0, anchorIndex + 1)
        : [...thread.messages];

    const newThread = await db.chatThread.create({
      data: {
        workspaceId: parsed.workspaceId,
        title: `${thread.title} (Fork)`,
        createdBy: user.id,
      },
    });

    if (messagesToCopy.length > 0) {
      await db.chatMessage.createMany({
        data: messagesToCopy.map((message) => ({
          threadId: newThread.id,
          authorUserId: message.authorUserId ?? null,
          role: message.role,
          content: message.content,
          modelId: message.modelId ?? null,
          latencyMs: message.latencyMs ?? null,
          tokenUsage: message.tokenUsage ?? null,
          status: message.status,
          commandName: message.commandName ?? null,
          isPinned: message.isPinned,
          attachmentUrl: message.attachmentUrl ?? null,
          attachmentMime: message.attachmentMime ?? null,
        })),
      });
    }

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.thread_forked",
      entityType: "chat_thread",
      entityId: newThread.id,
      metaJson: {
        fromThreadId: thread.id,
        copiedMessages: messagesToCopy.length,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: newThread.id,
        success: "Thread forked.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function pinMessageAction(formData: FormData) {
  const parsed = pinMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    threadId: formData.get("threadId"),
    messageId: formData.get("messageId"),
    pinned: (formData.get("pinned") as "0" | "1" | null) ?? undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);
    const message = await db.chatMessage.findFirst({
      where: {
        id: parsed.messageId,
        threadId: parsed.threadId,
        thread: {
          workspaceId: parsed.workspaceId,
        },
      },
    });
    if (!message) {
      throw new Error("Message not found.");
    }

    const targetPinned = parsed.pinned
      ? parsed.pinned === "1"
      : !message.isPinned;

    await db.chatMessage.update({
      where: { id: message.id },
      data: {
        isPinned: targetPinned,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_pinned_changed",
      entityType: "chat_message",
      entityId: message.id,
      metaJson: {
        pinned: targetPinned,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        success: targetPinned ? "Message pinned." : "Message unpinned.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function exportMessageAction(formData: FormData) {
  const parsed = exportMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    threadId: formData.get("threadId"),
    messageId: formData.get("messageId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);
    const message = await db.chatMessage.findFirst({
      where: {
        id: parsed.messageId,
        threadId: parsed.threadId,
        thread: {
          workspaceId: parsed.workspaceId,
        },
      },
    });
    if (!message) {
      throw new Error("Message not found.");
    }

    const artifact = await db.chatArtifact.create({
      data: {
        workspaceId: parsed.workspaceId,
        messageId: message.id,
        createdById: user.id,
        type: ChatArtifactType.MARKDOWN,
        title: `Exported message ${message.id.slice(0, 6)}`,
        content: message.content,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_exported",
      entityType: "chat_artifact",
      entityId: artifact.id,
      metaJson: {
        messageId: message.id,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        success: "Message exported to artifact.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function convertMessageAction(formData: FormData) {
  const parsed = convertMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    threadId: formData.get("threadId"),
    messageId: formData.get("messageId"),
    target: formData.get("target"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
      WorkspaceRole.VIEWER,
    ]);
    const message = await db.chatMessage.findFirst({
      where: {
        id: parsed.messageId,
        threadId: parsed.threadId,
        thread: {
          workspaceId: parsed.workspaceId,
        },
      },
    });
    if (!message) {
      throw new Error("Message not found.");
    }

    const artifactType =
      parsed.target === "automation"
        ? ChatArtifactType.AUTOMATION
        : parsed.target === "report"
          ? ChatArtifactType.REPORT
          : ChatArtifactType.TASK;

    const artifact = await db.chatArtifact.create({
      data: {
        workspaceId: parsed.workspaceId,
        messageId: message.id,
        createdById: user.id,
        type: artifactType,
        title: `Converted ${parsed.target}: ${message.id.slice(0, 6)}`,
        content: message.content,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: `chat.message_converted_${parsed.target}`,
      entityType: "chat_artifact",
      entityId: artifact.id,
      metaJson: {
        messageId: message.id,
        target: parsed.target,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        success: `Message converted to ${parsed.target}.`,
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        error: getErrorMessage(error),
      }),
    );
  }
}
