import { Bot, FileText, Sparkles, Workflow } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { SubmitButton } from "@/components/kit/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

import {
  generateAutomationDraftAction,
  generateKpiDraftAction,
  summarizeTableAction,
} from "./actions";

type AssistantPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function AssistantPage({
  searchParams,
}: AssistantPageProps) {
  const params = await searchParams;
  const { workspace } = await getAppContext(params.workspaceId);

  const [tables, assistantThread] = await Promise.all([
    db.table.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
    // include:messages selects columns added in migration 20260220181000;
    // fall back to null if schema is not yet applied.
    db.chatThread
      .findFirst({
        where: {
          workspaceId: workspace.id,
          title: "Assistant",
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
            take: 50,
          },
        },
      })
      .catch((err: unknown) => {
        if (!isDatabaseUnavailableError(err)) throw err;
        return null;
      }),
  ]);
  const defaultTableId = tables[0]?.id;

  return (
    <div className="space-y-6" data-testid="assistant-page">
      <PageHeader
        title="AI Assistant"
        subtitle="Summarize operational data, draft automations, and generate KPI layouts with auditable assistant actions."
      />

      <StatusBanner error={params.error} success={params.success} />

      <div className="grid gap-4 xl:grid-cols-[350px,1fr]">
        <div className="space-y-4">
          <GlassCard className="space-y-3">
            <h2 className="kpi-font text-xl font-semibold">Context</h2>
            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <p>Workspace: {workspace.name}</p>
              <p>Tables available: {tables.length}</p>
              <p>
                Assistant provider: {process.env.AI_PROVIDER_MODE ?? "cloud_free"}
              </p>
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[#9a6fff]" />
              <h3 className="text-sm font-semibold">Summarize table</h3>
            </div>
            <form action={summarizeTableAction} className="space-y-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Select
                name="tableId"
                {...(defaultTableId ? { defaultValue: defaultTableId } : {})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input name="filterText" placeholder="Optional filter text" />
              <SubmitButton className="w-full">
                Summarize
              </SubmitButton>
            </form>
          </GlassCard>

          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <Workflow className="size-4 text-[#9a6fff]" />
              <h3 className="text-sm font-semibold">
                Generate automation draft
              </h3>
            </div>
            <form action={generateAutomationDraftAction} className="space-y-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Textarea
                name="prompt"
                rows={4}
                placeholder="When a high-priority incident is created, notify on-call and log it in audit trail."
                required
              />
              <SubmitButton className="w-full">
                Draft JSON
              </SubmitButton>
            </form>
          </GlassCard>

          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#9a6fff]" />
              <h3 className="text-sm font-semibold">Draft KPI layout</h3>
            </div>
            <form action={generateKpiDraftAction} className="space-y-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Label htmlFor="objective">Objective</Label>
              <Textarea
                id="objective"
                name="objective"
                rows={3}
                placeholder="Create an executive dashboard for throughput, quality, and SLA risk."
                required
              />
              <SubmitButton className="w-full">
                Generate layout
              </SubmitButton>
            </form>
          </GlassCard>
        </div>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">Assistant chat</h2>
            <Badge variant="active">
              <Bot className="size-3.5" />
              Audited
            </Badge>
          </div>

          <ScrollArea className="h-[560px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3">
            <div className="space-y-3 pr-2">
              {assistantThread?.messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${
                    message.role === "USER"
                      ? "border-[var(--border)] bg-white/7 text-[var(--text)]"
                      : "border-[#9a6fff52] bg-[#9a6fff1e] text-[var(--text)]"
                  }`}
                >
                  <p className="mb-1 text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
                    {message.role}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </article>
              ))}

              {!assistantThread || assistantThread.messages.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No assistant messages yet. Run a capability action.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </GlassCard>
      </div>
    </div>
  );
}
