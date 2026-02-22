import Link from "next/link";
import { ChatRole } from "@prisma/client";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { features } from "@/lib/constants/features";
import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
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
    if (!isSchemaNotReadyError(error)) {
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
    if (!isSchemaNotReadyError(error)) {
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

  return (
    <div className="space-y-6" data-testid="chat-page">
      <PageHeader
        title={features.unifiedChat ? "Unified Chat Workspace" : "Team Chat"}
        subtitle="Cloud-first assistant workspace with slash commands, artifacts, pinned context, and auditable tool actions."
      />

      <StatusBanner error={params.error} success={params.success} />
      {hasSchemaFallback ? (
        <div className="rounded-[var(--radius-sm)] border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          Some chat enhancements are temporarily unavailable until migrations are
          applied. Core chat remains available.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px,1fr,340px]">
        <GlassCard className="space-y-4">
          {/* ─── Channels (Viber-like) ─────────────────────── */}
          {features.viberChat && channels.length > 0 && (
            <div className="space-y-2">
              <h2 className="kpi-font text-lg font-semibold">Channels</h2>
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
                  📬 All Threads
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
                      "focus-ring block rounded-[var(--radius-sm)] px-3 py-1.5 text-sm",
                      selectedChannelId === ch.id
                        ? "bg-[#9a6fff22] text-[var(--text)]"
                        : "text-[var(--text-muted)] hover:bg-white/7",
                    )}
                  >
                    <span className="truncate">
                      {ch.type === "DM" ? "💬" : "#"} {ch.name}
                    </span>
                    <span className="ml-1 text-xs text-[var(--text-muted)]">
                      {ch._count.threads}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <h2 className="kpi-font text-xl font-semibold">Threads</h2>

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
            <PrimaryButton type="submit" className="w-full">
              Create thread
            </PrimaryButton>
          </form>

          <ScrollArea className="h-[360px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-2">
            <div className="space-y-2 pr-2">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={chatQuery({
                    workspaceId: workspace.id,
                    threadId: thread.id,
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
                  <p className="text-xs text-[var(--text-muted)]">
                    {thread._count.messages} messages
                  </p>
                </Link>
              ))}
              {threads.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No threads yet.</p>
              ) : null}
            </div>
          </ScrollArea>

          <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Prompt Templates
            </p>
            {templates.map((template) => (
              <form key={template.id} action={sendMessageAction}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                <input type="hidden" name="modelId" value={modelId} />
                <input type="hidden" name="content" value={template.prompt} />
                <PrimaryButton
                  type="submit"
                  className="mb-2 w-full"
                  disabled={!activeThread}
                >
                  {template.title}
                </PrimaryButton>
              </form>
            ))}
            {templates.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Save templates from Settings to use them here.
              </p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="kpi-font text-xl font-semibold">
              {activeThread?.title ?? "Select a thread"}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Badge variant="active">{modelId}</Badge>
              <Badge variant="default">tools-enabled</Badge>
            </div>
          </div>

          <ScrollArea className="h-[520px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3">
            <div className="space-y-3 pr-2">
              {activeThread?.messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
                    getMessageTone(message.role),
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
                      {message.role}
                    </p>
                    <div className="flex items-center gap-1">
                      {message.isPinned ? <Badge variant="active">Pinned</Badge> : null}
                      {message.commandName ? (
                        <Badge variant="default">{message.commandName}</Badge>
                      ) : null}
                      {message.modelId ? (
                        <Badge variant="default">{message.modelId}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {message.role === ChatRole.ASSISTANT ? (
                      <>
                        <form action={regenerateMessageAction}>
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="threadId" value={activeThread.id} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <input type="hidden" name="modelId" value={modelId} />
                          <PrimaryButton type="submit">Regenerate</PrimaryButton>
                        </form>

                        <form action={exportMessageAction}>
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="threadId" value={activeThread.id} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <PrimaryButton type="submit">Export</PrimaryButton>
                        </form>

                        <form action={convertMessageAction}>
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="threadId" value={activeThread.id} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <input type="hidden" name="target" value="automation" />
                          <PrimaryButton type="submit">To Automation</PrimaryButton>
                        </form>

                        <form action={convertMessageAction}>
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="threadId" value={activeThread.id} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <input type="hidden" name="target" value="report" />
                          <PrimaryButton type="submit">To Report</PrimaryButton>
                        </form>
                      </>
                    ) : null}

                    <form action={pinMessageAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="threadId" value={activeThread.id} />
                      <input type="hidden" name="messageId" value={message.id} />
                      <PrimaryButton type="submit">
                        {message.isPinned ? "Unpin" : "Pin"}
                      </PrimaryButton>
                    </form>

                    <form action={forkThreadAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="threadId" value={activeThread.id} />
                      <input type="hidden" name="messageId" value={message.id} />
                      <PrimaryButton type="submit">Fork Here</PrimaryButton>
                    </form>
                  </div>
                </article>
              ))}

              {!activeThread || activeThread.messages.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No messages yet.</p>
              ) : null}
            </div>
          </ScrollArea>

          {activeThread ? (
            <form action={sendMessageAction} className="space-y-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="threadId" value={activeThread.id} />
              <input type="hidden" name="modelId" value={modelId} />
              <Label htmlFor="chat-message">Message or slash command</Label>
              <Textarea
                id="chat-message"
                name="content"
                rows={4}
                defaultValue={params.quickCommand ?? ""}
                placeholder="Type a message or /summarize-table incidents"
                required
              />
              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="submit">Send</PrimaryButton>
                <p className="text-xs text-[var(--text-muted)]">
                  Slash commands: /summarize-table, /draft-automation, /kpi-layout,
                  /create-shift, /log-fleet-event
                </p>
              </div>
            </form>
          ) : null}
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Tools & Artifacts</h2>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Quick Tool Invocations
            </p>
            <div className="grid gap-2">
              <form action={sendMessageAction}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                <input type="hidden" name="modelId" value={modelId} />
                <input type="hidden" name="content" value="/summarize-table" />
                <PrimaryButton type="submit" className="w-full" disabled={!activeThread}>
                  Summarize Table
                </PrimaryButton>
              </form>

              <form action={sendMessageAction}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                <input type="hidden" name="modelId" value={modelId} />
                <input
                  type="hidden"
                  name="content"
                  value="/draft-automation Alert admins when stale records exceed threshold"
                />
                <PrimaryButton type="submit" className="w-full" disabled={!activeThread}>
                  Draft Automation
                </PrimaryButton>
              </form>

              <form action={sendMessageAction}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                <input type="hidden" name="modelId" value={modelId} />
                <input
                  type="hidden"
                  name="content"
                  value="/kpi-layout Executive view for throughput, quality, and risk"
                />
                <PrimaryButton type="submit" className="w-full" disabled={!activeThread}>
                  KPI Layout
                </PrimaryButton>
              </form>
            </div>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Custom Quick Buttons
            </p>
            <div className="space-y-2">
              {actionButtons.map((button) => (
                <form key={button.id} action={sendMessageAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="threadId" value={activeThread?.id ?? ""} />
                  <input type="hidden" name="modelId" value={modelId} />
                  <input type="hidden" name="content" value={button.action} />
                  <PrimaryButton
                    type="submit"
                    className="w-full"
                    disabled={!activeThread}
                  >
                    {button.label}
                  </PrimaryButton>
                </form>
              ))}
              {actionButtons.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Configure quick buttons in Settings.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Pinned in Active Thread
            </p>
            <div className="space-y-2">
              {activePinnedMessages.map((message) => (
                <article
                  key={message.id}
                  className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2 text-xs"
                >
                  <p className="font-medium text-[var(--text)]">{message.role}</p>
                  <p className="whitespace-pre-wrap text-[var(--text-muted)]">
                    {message.content}
                  </p>
                </article>
              ))}
              {activePinnedMessages.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  No pinned messages in this thread.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Recent Artifacts
            </p>
            <ScrollArea className="h-[180px] rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2">
              <div className="space-y-2 pr-2">
                {artifacts.map((artifact) => (
                  <article
                    key={artifact.id}
                    className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/15 p-2 text-xs"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {artifact.type}: {artifact.title}
                    </p>
                    <p className="text-[var(--text-muted)]">
                      {artifact.createdAt.toISOString()}
                    </p>
                  </article>
                ))}
                {artifacts.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    No artifacts yet.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
