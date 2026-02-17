import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

import { createThreadAction, sendMessageAction } from "./actions";

type ChatPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    threadId?: string;
    error?: string;
    success?: string;
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

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext(params.workspaceId);

  const threads = await db.chatThread.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeThreadId = params.threadId ?? threads[0]?.id;

  const activeThread = activeThreadId
    ? await db.chatThread.findFirst({
        where: {
          id: activeThreadId,
          workspaceId: workspace.id,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      })
    : null;

  return (
    <div className="space-y-6" data-testid="chat-page">
      <PageHeader
        title="Team Chat"
        subtitle="Structured thread history for assistant outputs, handoffs, and internal ops collaboration."
      />

      <StatusBanner error={params.error} success={params.success} />

      <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <GlassCard className="space-y-4">
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
              placeholder="Incident triage sync"
              required
            />
            <PrimaryButton type="submit" className="w-full">
              Create thread
            </PrimaryButton>
          </form>

          <div className="space-y-2">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={chatQuery({
                  workspaceId: workspace.id,
                  threadId: thread.id,
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
              <p className="text-sm text-[var(--text-muted)]">
                No threads yet.
              </p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">
              {activeThread?.title ?? "Select a thread"}
            </h2>
          </div>

          <ScrollArea className="h-[520px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3">
            <div className="space-y-3 pr-2">
              {activeThread?.messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
                    message.role === "SYSTEM"
                      ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                      : message.role === "ASSISTANT"
                        ? "border-[#9a6fff52] bg-[#9a6fff20]"
                        : "border-[var(--border)] bg-white/8",
                  )}
                >
                  <p className="mb-1 text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
                    {message.role}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </article>
              ))}

              {!activeThread || activeThread.messages.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No messages yet.
                </p>
              ) : null}
            </div>
          </ScrollArea>

          {activeThread ? (
            <form action={sendMessageAction} className="space-y-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="threadId" value={activeThread.id} />
              <Label htmlFor="chat-message">Message</Label>
              <Textarea
                id="chat-message"
                name="content"
                rows={3}
                placeholder="Write an update..."
                required
              />
              <PrimaryButton type="submit">Send</PrimaryButton>
            </form>
          ) : null}
        </GlassCard>
      </div>
    </div>
  );
}
