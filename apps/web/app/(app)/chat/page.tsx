import Link from "next/link";
import { ChatRole } from "@prisma/client";
import { Mic, Paperclip, Search, SendHorizontal, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { GlassCard } from "@/components/kit/glass-card";
import { SubmitButton } from "@/components/kit/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { ensureDefaultChannels } from "@/lib/chat/default-channels";
import { features } from "@/lib/constants/features";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { logSecurityEvent } from "@/lib/security";
import { cn } from "@/lib/utils";

import {
  convertMessageAction,
  createThreadAction,
  exportMessageAction,
  forkThreadAction,
  pinMessageAction,
  regenerateMessageAction,
  sendMessageAction,
} from "./actions";

const DEFAULT_MODEL_ID = "free-cloud-primary:v1";

type ChatPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    threadId?: string;
    channelId?: string;
    error?: string;
    success?: string;
    quickCommand?: string;
    modelId?: string;
    query?: string;
    newConversation?: string;
  }>;
};

function chatQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return `/chat?${searchParams.toString()}`;
}

function getMessageTone(role: ChatRole) {
  if (role === ChatRole.SYSTEM) {
    return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  }

  if (role === ChatRole.ASSISTANT) {
    return "border-[#9a6fff52] bg-[#9a6fff20]";
  }

  return "border-[var(--border)] bg-white/8";
}

type ChatMessageView = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  isPinned: boolean;
  commandName: string | null;
  modelId: string | null;
};

type ActiveThreadView = {
  id: string;
  title: string;
  messages: ChatMessageView[];
};

type OptionalQueryResult<T> = {
  data: T;
  degraded: boolean;
};

async function runOptionalChatQuery<T>(input: {
  feature: string;
  query: () => Promise<T>;
  fallback: () => T;
}): Promise<OptionalQueryResult<T>> {
  try {
    return {
      data: await input.query(),
      degraded: false,
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    logSecurityEvent("chat.optional_query_schema_not_ready", {
      feature: input.feature,
      error: error instanceof Error ? error.message : "unknown",
    });

    return {
      data: input.fallback(),
      degraded: true,
    };
  }
}

type LegacyChatMessageRow = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date | string;
};

async function getActiveThreadView(input: {
  workspaceId: string;
  threadId: string;
}): Promise<{
  thread: ActiveThreadView | null;
  degraded: boolean;
}> {
  try {
    const thread = await db.chatThread.findFirst({
      where: {
        id: input.threadId,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
        title: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          take: 1000,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            isPinned: true,
            commandName: true,
            modelId: true,
          },
        },
      },
    });

    if (!thread) {
      return {
        thread: null,
        degraded: false,
      };
    }

    return {
      thread: {
        id: thread.id,
        title: thread.title,
        messages: thread.messages,
      },
      degraded: false,
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    logSecurityEvent("chat.active_thread_schema_not_ready", {
      threadId: input.threadId,
      error: error instanceof Error ? error.message : "unknown",
    });

    const thread = await db.chatThread.findFirst({
      where: {
        id: input.threadId,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!thread) {
      return {
        thread: null,
        degraded: true,
      };
    }

    const legacyMessages = await db.$queryRaw<LegacyChatMessageRow[]>`
      SELECT "id", "role", "content", "createdAt"
      FROM "ChatMessage"
      WHERE "threadId" = ${input.threadId}
      ORDER BY "createdAt" ASC
      LIMIT 1000
    `;

    return {
      thread: {
        id: thread.id,
        title: thread.title,
        messages: legacyMessages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt:
            message.createdAt instanceof Date
              ? message.createdAt
              : new Date(message.createdAt),
          isPinned: false,
          commandName: null,
          modelId: null,
        })),
      },
      degraded: true,
    };
  }
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  const { workspace, user } = await getAppContext(params.workspaceId);
  const modelId = params.modelId ?? DEFAULT_MODEL_ID;

  // ─── Ensure default channels exist ─────────────────────────────────
  await ensureDefaultChannels(workspace.id);

  // ─── Load channels (if Viber-like chat enabled) ───────────────────
  const channelsResult = await runOptionalChatQuery({
    feature: "chat_channels",
    query: () =>
      db.chatChannel.findMany({
        where: { workspaceId: workspace.id, isArchived: false },
        orderBy: { name: "asc" },
        include: { _count: { select: { threads: true, members: true } } },
      }),
    fallback: () => [],
  });
  const channels = channelsResult.data;
  const selectedChannelId = params.channelId;

  if (params.newConversation === "1") {
    const createdThread = await db.chatThread.create({
      data: {
        workspaceId: workspace.id,
        channelId: selectedChannelId ?? null,
        title: `Conversation ${new Date().toLocaleString()}`,
        createdBy: user.id,
      },
      select: { id: true },
    });

    redirect(
      chatQuery({
        workspaceId: workspace.id,
        threadId: createdThread.id,
        channelId: selectedChannelId,
        modelId,
      }),
    );
  }

  const [threads, templatesResult, actionButtonsResult, artifactsResult] = await Promise.all([
    db.chatThread.findMany({
      where: {
        workspaceId: workspace.id,
        ...(selectedChannelId ? { channelId: selectedChannelId } : {}),
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    runOptionalChatQuery({
      feature: "prompt_templates",
      query: () =>
        db.promptTemplate.findMany({
          where: {
            workspaceId: workspace.id,
            userId: user.id,
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
      fallback: () => [],
    }),
    runOptionalChatQuery({
      feature: "user_action_buttons",
      query: () =>
        db.userActionButton.findMany({
          where: {
            workspaceId: workspace.id,
            userId: user.id,
          },
          orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
          take: 10,
        }),
      fallback: () => [],
    }),
    runOptionalChatQuery({
      feature: "chat_artifacts",
      query: () =>
        db.chatArtifact.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      fallback: () => [],
    }),
  ]);

  const templates = templatesResult.data;
  const actionButtons = actionButtonsResult.data;
  const artifacts = artifactsResult.data;
  const activeThreadId = params.threadId ?? threads[0]?.id;
  const activeThreadState = activeThreadId
    ? await getActiveThreadView({
        workspaceId: workspace.id,
        threadId: activeThreadId,
      })
    : {
        thread: null,
        degraded: false,
      };
  const activeThread = activeThreadState.thread;
  const hasSchemaFallback =
    templatesResult.degraded ||
    actionButtonsResult.degraded ||
    artifactsResult.degraded ||
    activeThreadState.degraded;

  const activePinnedMessages =
    activeThread?.messages.filter((message) => message.isPinned) ?? [];

  const messageQuery = params.query?.trim().toLowerCase() ?? "";
  const visibleMessages = messageQuery
    ? (activeThread?.messages ?? []).filter((message) =>
        message.content.toLowerCase().includes(messageQuery),
      )
    : activeThread?.messages ?? [];

  return (
    <div className="space-y-4 pb-18 lg:space-y-5" data-testid="chat-page">
      <PageHeader
        title={features.unifiedChat ? "Operations Copilot Chat" : "Team Chat"}
        subtitle="Chat-first workspace for ops threads, channels, and AI-assisted actions. Keep conversations contextual to fleet, shifts, and washer workflows."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="active">{modelId}</Badge>
            <Link
              href={chatQuery({
                workspaceId: workspace.id,
                channelId: selectedChannelId,
                modelId,
                newConversation: "1",
              })}
              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[#9a6fff66] bg-[#9a6fff24] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
            >
              <Sparkles className="size-3.5" />
              New conversation
            </Link>
          </div>
        }
      />

      <StatusBanner error={params.error} success={params.success} />
      {hasSchemaFallback ? (
        <div className="rounded-[var(--radius-sm)] border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          Some chat enhancements are temporarily unavailable until migrations are
          applied. Core chat remains available.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[290px,1fr] xl:grid-cols-[320px,1fr,310px]">
        <GlassCard className="space-y-4">
          {features.viberChat && channels.length > 0 ? (
            <div className="space-y-2">
              <h2 className="kpi-font text-lg font-semibold">Workspace Channels</h2>
              <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-2">
                <Link
                  href={chatQuery({ workspaceId: workspace.id, modelId })}
                  className={cn(
                    "focus-ring block rounded-[var(--radius-sm)] px-3 py-1.5 text-sm",
                    !selectedChannelId
                      ? "bg-[#9a6fff22] text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:bg-white/7",
                  )}
                >
                  # all-conversations
                </Link>
                {channels.map((ch) => (
                  <Link
                    key={ch.id}
                    href={chatQuery({
                      workspaceId: workspace.id,
                      channelId: ch.id,
                      modelId,
                    })}
                    className={cn(
                      "focus-ring flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm",
                      selectedChannelId === ch.id
                        ? "bg-[#9a6fff22] text-[var(--text)]"
                        : "text-[var(--text-muted)] hover:bg-white/7",
                    )}
                  >
                    <span className="truncate"># {ch.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{ch._count.threads}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <form
            action={createThreadAction}
            className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
          >
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <Label htmlFor="thread-title">New thread</Label>
            <Input
              id="thread-title"
              name="title"
              placeholder="Ops command center"
              required
            />
            <SubmitButton className="w-full">Create thread</SubmitButton>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="kpi-font text-lg font-semibold">Recent Threads</h2>
              <span className="text-xs text-[var(--text-muted)]">{threads.length}</span>
            </div>
            <ScrollArea className="h-[320px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-2">
              <div className="space-y-2 pr-2">
                {threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={chatQuery({
                      workspaceId: workspace.id,
                      threadId: thread.id,
                      channelId: selectedChannelId,
                      modelId,
                    })}
                    className={cn(
                      "focus-ring block rounded-[var(--radius-sm)] border border-transparent px-3 py-2 text-sm",
                      activeThread?.id === thread.id
                        ? "border-[#9a6fff66] bg-[#9a6fff22] text-[var(--text)]"
                        : "text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-white/7",
                    )}
                  >
                    <p className="truncate">{thread.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{thread._count.messages} messages</p>
                  </Link>
                ))}
                {threads.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No threads yet.</p>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </GlassCard>

        <GlassCard className="relative min-h-[72vh] space-y-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="kpi-font text-xl font-semibold">
                {activeThread?.title ?? "Select a thread"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Chat-first incident and operations workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">tools-enabled</Badge>
              <Badge variant="active">{visibleMessages.length} visible</Badge>
            </div>
          </div>

          <form action="/chat" className="relative">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            {activeThread?.id ? <input type="hidden" name="threadId" value={activeThread.id} /> : null}
            {selectedChannelId ? <input type="hidden" name="channelId" value={selectedChannelId} /> : null}
            <input type="hidden" name="modelId" value={modelId} />
            <Label htmlFor="search-chat" className="sr-only">
              Search within chat
            </Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="search-chat"
              name="query"
              defaultValue={params.query ?? ""}
              placeholder="Search within chat history..."
              className="pl-9"
            />
          </form>

          <ScrollArea className="h-[calc(72vh-260px)] min-h-[320px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-black/10 p-4">
            <div className="space-y-4 pr-2">
              {visibleMessages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[92%] rounded-2xl border px-3 py-2 text-sm shadow-[0_12px_22px_rgba(0,0,0,0.18)]",
                    message.role === ChatRole.USER ? "ml-auto rounded-br-sm border-[#7fa8ff45] bg-[#4f73bf29]" : "",
                    message.role !== ChatRole.USER ? "rounded-bl-sm" : "",
                    getMessageTone(message.role),
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
                      {message.role}
                    </p>
                    <div className="flex items-center gap-1">
                      {message.isPinned ? <Badge variant="active">Pinned</Badge> : null}
                      {message.commandName ? <Badge variant="default">{message.commandName}</Badge> : null}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {message.role === ChatRole.ASSISTANT ? (
                      <>
                        <form action={regenerateMessageAction}>
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <input type="hidden" name="modelId" value={modelId} />
                          <SubmitButton>Regenerate</SubmitButton>
                        </form>
                        <form action={exportMessageAction}>
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <SubmitButton>Export</SubmitButton>
                        </form>
                      </>
                    ) : null}

                    <form action={pinMessageAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                      <input type="hidden" name="messageId" value={message.id} />
                      <SubmitButton>{message.isPinned ? "Unpin" : "Pin"}</SubmitButton>
                    </form>

                    <form action={forkThreadAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                      <input type="hidden" name="messageId" value={message.id} />
                      <SubmitButton>Fork Here</SubmitButton>
                    </form>

                    <form action={convertMessageAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                      <input type="hidden" name="messageId" value={message.id} />
                      <input type="hidden" name="target" value="automation" />
                      <SubmitButton>To Automation</SubmitButton>
                    </form>
                  </div>
                </article>
              ))}
              {!activeThread || visibleMessages.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {messageQuery ? "No messages matched your search." : "No messages yet."}
                </p>
              ) : null}
            </div>
          </ScrollArea>

          {activeThread ? (
            <form action={sendMessageAction} className="sticky bottom-0 space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgb(8_10_19_/_0.92)] p-3">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="threadId" value={activeThread.id} />
              <input type="hidden" name="modelId" value={modelId} />
              <Label htmlFor="chat-message">Message</Label>
              <Textarea
                id="chat-message"
                name="content"
                rows={3}
                defaultValue={params.quickCommand ?? ""}
                placeholder="Type a message or /summarize-table incidents"
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white/5 text-[var(--text-muted)]"
                    aria-label="Attach file"
                  >
                    <Paperclip className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white/5 text-[var(--text-muted)]"
                    aria-label="Voice input"
                  >
                    <Mic className="size-4" />
                  </button>
                  <p className="text-xs text-[var(--text-muted)]">Streaming ready · typing indicator active</p>
                </div>
                <SubmitButton className="inline-flex items-center gap-1.5">
                  <SendHorizontal className="size-4" />
                  Send
                </SubmitButton>
              </div>
            </form>
          ) : null}
        </GlassCard>

        <GlassCard className="hidden space-y-4 xl:block">
          <h2 className="kpi-font text-xl font-semibold">Context</h2>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Prompt Templates</p>
            <div className="space-y-2">
              {templates.map((template) => (
                <form key={template.id} action={sendMessageAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                  <input type="hidden" name="modelId" value={modelId} />
                  <input type="hidden" name="content" value={template.prompt} />
                  <SubmitButton className="w-full" disabled={!activeThread}>
                    {template.title}
                  </SubmitButton>
                </form>
              ))}
              {templates.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Save templates from Settings to use them here.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Quick Buttons</p>
            <div className="space-y-2">
              {actionButtons.map((button) => (
                <form key={button.id} action={sendMessageAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                  <input type="hidden" name="modelId" value={modelId} />
                  <input type="hidden" name="content" value={button.action} />
                  <SubmitButton className="w-full" disabled={!activeThread}>
                    {button.label}
                  </SubmitButton>
                </form>
              ))}
              {actionButtons.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Configure quick buttons in Settings.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Pinned in Active Thread</p>
            <div className="space-y-2">
              {activePinnedMessages.map((message) => (
                <article
                  key={message.id}
                  className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2 text-xs"
                >
                  <p className="font-medium text-[var(--text)]">{message.role}</p>
                  <p className="whitespace-pre-wrap text-[var(--text-muted)]">{message.content}</p>
                </article>
              ))}
              {activePinnedMessages.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No pinned messages in this thread.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent Artifacts</p>
            <ScrollArea className="h-[220px] rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2">
              <div className="space-y-2 pr-2">
                {artifacts.map((artifact) => (
                  <article
                    key={artifact.id}
                    className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/15 p-2 text-xs"
                  >
                    <p className="font-medium text-[var(--text)]">{artifact.type}: {artifact.title}</p>
                    <p className="text-[var(--text-muted)]">{artifact.createdAt.toISOString()}</p>
                  </article>
                ))}
                {artifacts.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">No artifacts yet.</p>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
