import { AutomationRunStatus, WorkspaceRole } from "@prisma/client";
import { Play, WandSparkles } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

import { createAutomationAction, runAutomationNowAction } from "./actions";

type AutomationsPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    error?: string;
    success?: string;
  }>;
};

function statusVariant(status: AutomationRunStatus) {
  if (status === AutomationRunStatus.SUCCESS) {
    return "success" as const;
  }

  if (status === AutomationRunStatus.FAILED) {
    return "danger" as const;
  }

  return "default" as const;
}

export default async function AutomationsPage({
  searchParams,
}: AutomationsPageProps) {
  const params = await searchParams;
  const { workspace, workspaceRole } = await getAppContext(params.workspaceId);
  const canEdit = workspaceRole !== WorkspaceRole.VIEWER;

  function safeFindMany<T>(p: Promise<T[]>) {
    return p.catch((err: unknown): T[] => {
      if (!isDatabaseUnavailableError(err)) throw err;
      return [];
    });
  }

  const [tables, users, automations, runs] = await Promise.all([
    safeFindMany(db.table.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    })),
    safeFindMany(db.user.findMany({
      where: {
        workspaceMemberships: {
          some: {
            workspaceId: workspace.id,
          },
        },
      },
      orderBy: { email: "asc" },
    })),
    safeFindMany(db.automation.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    })),
    safeFindMany(db.automationRun.findMany({
      where: {
        automation: {
          workspaceId: workspace.id,
        },
      },
      include: {
        automation: true,
      },
      orderBy: { startedAt: "desc" },
      take: 30,
    })),
  ]);

  return (
    <div className="space-y-6" data-testid="automations-page">
      <PageHeader
        title="Automations"
        subtitle="Build triggers and actions, run workflows manually, and inspect run logs for every execution."
      />

      <StatusBanner error={params.error} success={params.success} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">
              Automation Wizard
            </h2>
            <Badge variant="active">
              <WandSparkles className="size-3.5" />
              Trigger + Actions
            </Badge>
          </div>

          {canEdit ? (
            <form action={createAutomationAction} className="space-y-3">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <div className="space-y-1">
                <Label htmlFor="automation-name">Name</Label>
                <Input
                  id="automation-name"
                  name="name"
                  required
                  placeholder="Notify on high-priority update"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="triggerType">Trigger type</Label>
                <Select name="triggerType" defaultValue="record.created">
                  <SelectTrigger id="triggerType">
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="record.created">
                      record.created
                    </SelectItem>
                    <SelectItem value="record.updated">
                      record.updated
                    </SelectItem>
                    <SelectItem value="schedule.cron.daily">
                      schedule.cron.daily
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="triggerTableId">Trigger table (optional)</Label>
                <Select name="triggerTableId">
                  <SelectTrigger id="triggerTableId">
                    <SelectValue placeholder="No specific table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
                <p className="mb-2 text-sm text-[var(--text-muted)]">
                  Action: Create notification
                </p>
                <div className="grid gap-2">
                  <Select name="notificationUserId">
                    <SelectTrigger>
                      <SelectValue placeholder="Notify user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    name="notificationTitle"
                    placeholder="Notification title"
                  />
                  <Input
                    name="notificationBody"
                    placeholder="Notification body"
                  />
                </div>
              </div>

              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
                <p className="mb-2 text-sm text-[var(--text-muted)]">
                  Action: Write audit log
                </p>
                <Input
                  name="auditAction"
                  placeholder="automation.custom.action"
                />
              </div>

              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
                <p className="mb-2 text-sm text-[var(--text-muted)]">
                  Action: Update record
                </p>
                <div className="grid gap-2">
                  <Select name="updateRecordTableId">
                    <SelectTrigger>
                      <SelectValue placeholder="Target table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input name="updateRecordId" placeholder="Record ID" />
                  <Input name="updateRecordField" placeholder="Field name" />
                  <Input name="updateRecordValue" placeholder="New value" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked
                  className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
                />
                Enabled
              </label>

              <PrimaryButton type="submit" className="w-full">
                Save automation
              </PrimaryButton>
            </form>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Viewer role cannot create or run automations.
            </p>
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Automations</h2>
          <div className="space-y-3">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {automation.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {JSON.stringify(automation.triggerJson)}
                    </p>
                  </div>
                  <Badge variant={automation.enabled ? "active" : "default"}>
                    {automation.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {canEdit ? (
                  <form action={runAutomationNowAction} className="mt-3">
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspace.id}
                    />
                    <input
                      type="hidden"
                      name="automationId"
                      value={automation.id}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      <Play className="size-3.5" />
                      Run now
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
            {automations.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No automations yet.
              </p>
            ) : null}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Runs</h2>
        <div className="space-y-2">
          {runs.map((run) => {
            const logs = Array.isArray(run.logsJson)
              ? (run.logsJson as Array<{ level: string; message: string }>)
              : [];

            return (
              <details
                key={run.id}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[var(--text)]">
                      {run.automation.name} ·{" "}
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                    <Badge variant={statusVariant(run.status)}>
                      {run.status}
                    </Badge>
                  </div>
                </summary>
                <div className="mt-3 space-y-2">
                  {logs.map((log, index) => (
                    <div
                      key={`${run.id}-${index}`}
                      className="rounded border border-[var(--border)] bg-black/20 px-2 py-1 text-xs"
                    >
                      <span className="font-medium">[{log.level}]</span>{" "}
                      {log.message}
                    </div>
                  ))}
                  {logs.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      No logs captured.
                    </p>
                  ) : null}
                </div>
              </details>
            );
          })}
          {runs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No automation runs yet.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
