"use server";

import { ChatChannelType, ChatRole, WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireAdminAccess, requireWorkspaceRole } from "@/lib/rbac";
import {
  createChannelSchema,
  updateChannelSchema,
  joinChannelSchema,
  sendChannelMessageSchema,
  reactToMessageSchema,
  pinMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
} from "@/lib/validators/chat-channels";

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const s = query.toString();
  return s ? `${base}?${s}` : base;
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}

export async function createChannelAction(formData: FormData) {
  const parsed = createChannelSchema.parse({
    workspaceId: formData.get("workspaceId"),
    type: formData.get("type") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    isReadOnly: formData.get("isReadOnly") || undefined,
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    const channel = await db.chatChannel.create({
      data: {
        workspaceId: parsed.workspaceId,
        type: parsed.type ?? ChatChannelType.PUBLIC,
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? null,
        isReadOnly: parsed.isReadOnly ?? false,
        createdBy: user.id,
      },
    });

    // Auto-join creator
    await db.chatChannelMember.create({
      data: {
        channelId: channel.id,
        userId: user.id,
        role: "admin",
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.channel_created",
      entityType: "chat_channel",
      entityId: channel.id,
      metaJson: { name: channel.name, slug: channel.slug, type: channel.type },
    });

    revalidatePath("/chat");
    redirect(buildUrl("/chat", { success: `Channel #${channel.slug} created.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/chat", { error: getErrorMessage(error) }));
  }
}

export async function updateChannelAction(formData: FormData) {
  const parsed = updateChannelSchema.parse({
    workspaceId: formData.get("workspaceId"),
    channelId: formData.get("channelId"),
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    isPinned: formData.get("isPinned") ?? undefined,
    isArchived: formData.get("isArchived") ?? undefined,
    isReadOnly: formData.get("isReadOnly") ?? undefined,
  });

  try {
    const { user } = await requireAdminAccess(parsed.workspaceId);

    const updated = await db.chatChannel.update({
      where: { id: parsed.channelId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.isPinned !== undefined ? { isPinned: parsed.isPinned } : {}),
        ...(parsed.isArchived !== undefined ? { isArchived: parsed.isArchived } : {}),
        ...(parsed.isReadOnly !== undefined ? { isReadOnly: parsed.isReadOnly } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.channel_updated",
      entityType: "chat_channel",
      entityId: updated.id,
      metaJson: { name: updated.name },
    });

    revalidatePath("/chat");
    redirect(buildUrl("/chat", { success: "Channel updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/chat", { error: getErrorMessage(error) }));
  }
}

export async function joinChannelAction(formData: FormData) {
  const parsed = joinChannelSchema.parse({
    workspaceId: formData.get("workspaceId"),
    channelId: formData.get("channelId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER, WorkspaceRole.VIEWER,
    ]);

    await db.chatChannelMember.upsert({
      where: {
        channelId_userId: {
          channelId: parsed.channelId,
          userId: user.id,
        },
      },
      create: {
        channelId: parsed.channelId,
        userId: user.id,
      },
      update: {},
    });

    revalidatePath("/chat");
    redirect(buildUrl("/chat", { success: "Joined channel." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/chat", { error: getErrorMessage(error) }));
  }
}

export async function sendChannelMessageAction(formData: FormData) {
  const parsed = sendChannelMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    channelId: formData.get("channelId"),
    content: formData.get("content"),
    replyToId: formData.get("replyToId") || undefined,
    attachmentUrl: formData.get("attachmentUrl") || undefined,
    attachmentMime: formData.get("attachmentMime") || undefined,
    mentionsJson: formData.get("mentionsJson") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER,
    ]);

    // Check channel exists and is not read-only (unless user is admin)
    const channel = await db.chatChannel.findUniqueOrThrow({
      where: { id: parsed.channelId },
    });

    if (channel.isReadOnly) {
      // Check if user is channel admin or workspace admin
      const membership = await db.chatChannelMember.findUnique({
        where: {
          channelId_userId: {
            channelId: parsed.channelId,
            userId: user.id,
          },
        },
      });
      const isChannelAdmin = membership?.role === "admin";
      const wsMembership = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: parsed.workspaceId,
            userId: user.id,
          },
        },
      });
      const isWsAdmin = wsMembership?.role === WorkspaceRole.ADMIN;
      if (!isChannelAdmin && !isWsAdmin) {
        throw new AuthError("This channel is read-only.");
      }
    }

    // Find or create a thread for this channel
    let thread = await db.chatThread.findFirst({
      where: {
        channelId: parsed.channelId,
        isArchived: false,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!thread) {
      thread = await db.chatThread.create({
        data: {
          workspaceId: parsed.workspaceId,
          channelId: parsed.channelId,
          title: channel.name,
          createdBy: user.id,
        },
      });
    }

    const mentions = parsed.mentionsJson ? JSON.parse(parsed.mentionsJson) : null;

    await db.chatMessage.create({
      data: {
        threadId: thread.id,
        authorUserId: user.id,
        role: ChatRole.USER,
        content: parsed.content,
        replyToId: parsed.replyToId ?? null,
        attachmentUrl: parsed.attachmentUrl ?? null,
        attachmentMime: parsed.attachmentMime ?? null,
        mentionsJson: mentions,
      },
    });

    revalidatePath("/chat");
    return { success: true };
  } catch (error) {
    rethrowIfRedirectError(error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function reactToMessageAction(formData: FormData) {
  const parsed = reactToMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    messageId: formData.get("messageId"),
    emoji: formData.get("emoji"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE,
      WorkspaceRole.WASHER, WorkspaceRole.VIEWER,
    ]);

    // Toggle: if exists, remove; if not, add
    const existing = await db.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: parsed.messageId,
          userId: user.id,
          emoji: parsed.emoji,
        },
      },
    });

    if (existing) {
      await db.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await db.chatReaction.create({
        data: {
          messageId: parsed.messageId,
          userId: user.id,
          emoji: parsed.emoji,
        },
      });
    }

    revalidatePath("/chat");
    return { success: true };
  } catch (error) {
    rethrowIfRedirectError(error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function pinMessageAction(formData: FormData) {
  const parsed = pinMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    messageId: formData.get("messageId"),
    isPinned: formData.get("isPinned"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR,
    ]);

    await db.chatMessage.update({
      where: { id: parsed.messageId },
      data: { isPinned: parsed.isPinned },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: parsed.isPinned ? "chat.message_pinned" : "chat.message_unpinned",
      entityType: "chat_message",
      entityId: parsed.messageId,
      metaJson: {},
    });

    revalidatePath("/chat");
    return { success: true };
  } catch (error) {
    rethrowIfRedirectError(error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function editMessageAction(formData: FormData) {
  const parsed = editMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    messageId: formData.get("messageId"),
    content: formData.get("content"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE, WorkspaceRole.WASHER,
    ]);

    const message = await db.chatMessage.findUnique({
      where: { id: parsed.messageId },
      select: { authorUserId: true },
    });

    if (!message) {
      return { success: false, error: "Message not found." };
    }

    // Only the author or admin can edit
    if (message.authorUserId !== user.id) {
      const isAdmin = await requireWorkspaceRole(parsed.workspaceId, [WorkspaceRole.ADMIN]).then(() => true).catch(() => false);
      if (!isAdmin) {
        return { success: false, error: "You can only edit your own messages." };
      }
    }

    await db.chatMessage.update({
      where: { id: parsed.messageId },
      data: {
        content: parsed.content,
        isEdited: true,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_edited",
      entityType: "chat_message",
      entityId: parsed.messageId,
      metaJson: {},
    });

    revalidatePath("/chat");
    return { success: true };
  } catch (error) {
    rethrowIfRedirectError(error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteMessageAction(formData: FormData) {
  const parsed = deleteMessageSchema.parse({
    workspaceId: formData.get("workspaceId"),
    messageId: formData.get("messageId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE, WorkspaceRole.WASHER,
    ]);

    const message = await db.chatMessage.findUnique({
      where: { id: parsed.messageId },
      select: { authorUserId: true },
    });

    if (!message) {
      return { success: false, error: "Message not found." };
    }

    if (message.authorUserId !== user.id) {
      const isAdmin = await requireWorkspaceRole(parsed.workspaceId, [WorkspaceRole.ADMIN]).then(() => true).catch(() => false);
      if (!isAdmin) {
        return { success: false, error: "You can only delete your own messages." };
      }
    }

    // Soft-delete: replace content, keep record for audit
    await db.chatMessage.update({
      where: { id: parsed.messageId },
      data: {
        content: "[Message deleted]",
        isEdited: true,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "chat.message_deleted",
      entityType: "chat_message",
      entityId: parsed.messageId,
      metaJson: {},
    });

    revalidatePath("/chat");
    return { success: true };
  } catch (error) {
    rethrowIfRedirectError(error);
    return { success: false, error: getErrorMessage(error) };
  }
}
