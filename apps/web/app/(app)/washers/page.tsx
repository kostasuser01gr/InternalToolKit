import { WasherTaskStatus } from "@prisma/client";
import { format, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";

import { DataTable } from "@/components/kit/data-table";
import { ExportButton } from "@/components/kit/export-button";
import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { VoiceInput } from "@/components/kit/voice-input";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { hasWorkspacePermission } from "@/lib/rbac";

import { createWasherTaskAction, updateWasherTaskAction } from "./actions";

type WashersPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    error?: string;
    success?: string;
    registerDate?: string;
  }>;
};

export default async function WashersPage({ searchParams }: WashersPageProps) {
  const params = await searchParams;
  const { workspace, workspaceRole } = await getAppContext(params.workspaceId);

  const canRead = hasWorkspacePermission(workspaceRole, "washers", "read");
  const canWrite = hasWorkspacePermission(workspaceRole, "washers", "write");

  if (!canRead) {
    return (
      <GlassCard data-testid="washers-blocked" className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Washer access required</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your role does not include washer operations access.
        </p>
      </GlassCard>
    );
  }

  const [vehicles, members, tasks] = await Promise.all([
    db.vehicle.findMany({
      where: {
        workspaceId: workspace.id,
      },
      orderBy: {
        plateNumber: "asc",
      },
    }),
    db.workspaceMember.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        user: true,
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    }),
    db.washerTask.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        vehicle: true,
        washer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
    }),
  ]);

  // Daily register: date-filtered list
  const registerDate = params.registerDate
    ? new Date(params.registerDate)
    : new Date();
  const registerDateStr = format(registerDate, "yyyy-MM-dd");

  const dailyTasks = await db.washerTask.findMany({
    where: {
      workspaceId: workspace.id,
      createdAt: {
        gte: startOfDay(registerDate),
        lte: endOfDay(registerDate),
      },
    },
    include: { vehicle: true, washer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6" data-testid="washers-page">
      <PageHeader
        title="Washer Operations"
        subtitle="Fast clean-task logging for exterior/interior/vacuum with optional voice notes."
        action={
          <Button asChild variant="outline">
            <Link href="/washers/app" target="_blank">Open Kiosk App</Link>
          </Button>
        }
      />

      <StatusBanner error={params.error} success={params.success} />

      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Create Wash Task</h2>
          <form action={createWasherTaskAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />

            <div className="space-y-1">
              <Label htmlFor="washer-vehicle">Vehicle</Label>
              <select
                id="washer-vehicle"
                name="vehicleId"
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                required
                disabled={!canWrite}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber} · {vehicle.model}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="washer-user">Washer</Label>
              <select
                id="washer-user"
                name="washerUserId"
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                defaultValue=""
                disabled={!canWrite}
              >
                <option value="">Current operator</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="washer-status">Status</Label>
              <select
                id="washer-status"
                name="status"
                defaultValue={WasherTaskStatus.TODO}
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                disabled={!canWrite}
              >
                {Object.values(WasherTaskStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input type="checkbox" name="exteriorDone" className="focus-ring size-4" />
                Exterior
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input type="checkbox" name="interiorDone" className="focus-ring size-4" />
                Interior
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input type="checkbox" name="vacuumDone" className="focus-ring size-4" />
                Vacuum
              </label>
            </div>

            <div className="space-y-1">
              <Label htmlFor="washer-notes">Notes / Voice-to-text</Label>
              <VoiceInput
                id="washer-notes"
                name="notes"
                transcriptFieldName="voiceTranscript"
                placeholder="Describe cleaning details or issues."
                rows={4}
              />
            </div>

            <PrimaryButton type="submit" disabled={!canWrite}>
              Save wash task
            </PrimaryButton>
          </form>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Task Queue</h2>
          <div className="space-y-3">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[var(--text)]">
                    {task.vehicle.plateNumber} · {task.vehicle.model}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{task.status}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Washer: {task.washer?.name ?? "Unassigned"} · {format(task.createdAt, "dd MMM HH:mm")}
                </p>

                <form action={updateWasherTaskAction} className="mt-3 space-y-3">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="taskId" value={task.id} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`task-status-${task.id}`}>Status</Label>
                      <select
                        id={`task-status-${task.id}`}
                        name="status"
                        defaultValue={task.status}
                        className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                        disabled={!canWrite}
                      >
                        {Object.values(WasherTaskStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`task-notes-${task.id}`}>Notes</Label>
                      <Input
                        id={`task-notes-${task.id}`}
                        name="notes"
                        defaultValue={task.notes ?? ""}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        name="exteriorDone"
                        defaultChecked={task.exteriorDone}
                        className="focus-ring size-4"
                      />
                      Exterior
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        name="interiorDone"
                        defaultChecked={task.interiorDone}
                        className="focus-ring size-4"
                      />
                      Interior
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        name="vacuumDone"
                        defaultChecked={task.vacuumDone}
                        className="focus-ring size-4"
                      />
                      Vacuum
                    </label>
                  </div>

                  <Textarea
                    name="voiceTranscript"
                    defaultValue={task.voiceTranscript ?? ""}
                    rows={2}
                    placeholder="Voice transcript (optional)"
                    disabled={!canWrite}
                  />

                  <PrimaryButton type="submit" disabled={!canWrite}>
                    Update task
                  </PrimaryButton>
                </form>
              </article>
            ))}

            {tasks.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No washer tasks yet.</p>
            ) : null}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="space-y-4" data-testid="daily-register">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="kpi-font text-xl font-semibold">Daily Register</h2>
          <div className="flex items-center gap-2">
            <form className="flex items-center gap-2">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Input
                type="date"
                name="registerDate"
                defaultValue={registerDateStr}
                className="h-9 w-40"
              />
              <PrimaryButton type="submit" className="h-9 px-3 text-sm">
                Go
              </PrimaryButton>
            </form>
            <ExportButton
              href={`/api/washers/export?workspaceId=${workspace.id}&date=${registerDateStr}`}
              label="Export CSV"
            />
          </div>
        </div>

        <DataTable
          columns={[
            { key: "plate", label: "Vehicle" },
            { key: "status", label: "Status" },
            { key: "exterior", label: "Ext" },
            { key: "interior", label: "Int" },
            { key: "vacuum", label: "Vac" },
            { key: "washer", label: "Washer" },
            { key: "station", label: "Station" },
            { key: "time", label: "Time" },
          ]}
          rows={dailyTasks.map((t) => ({
            id: t.id,
            cells: [
              `${t.vehicle.plateNumber} · ${t.vehicle.model}`,
              t.status,
              t.exteriorDone ? "✓" : "—",
              t.interiorDone ? "✓" : "—",
              t.vacuumDone ? "✓" : "—",
              t.washer?.name ?? "Kiosk",
              t.stationId ?? "—",
              format(t.createdAt, "HH:mm"),
            ],
          }))}
          emptyTitle="No tasks for this day"
          emptyDescription="Select a different date or create tasks via the form above or the kiosk."
        />
      </GlassCard>
    </div>
  );
}
