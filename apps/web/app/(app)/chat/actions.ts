"use server";

import { ChatRole, WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspaceRole } from "@/lib/rbac";
import { createThreadSchema, sendMessageSchema } from "@/lib/validators/chat";

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
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_sent",
      entityType: "chat_thread",
      entityId: thread.id,
      metaJson: {
        contentLength: parsed.content.length,
      },
    });

    revalidatePath("/chat");
    redirect(
      buildChatUrl({
        workspaceId: parsed.workspaceId,
        threadId: thread.id,
        success: "Message sent.",
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
