import { WasherTaskStatus } from "@prisma/client";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import Link from "next/link";

import { ExportButton } from "@/components/kit/export-button";
import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { VoiceInput } from "@/components/kit/voice-input";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { hasWorkspacePermission } from "@/lib/rbac";

import { createWasherTaskAction } from "./actions";
import { DailyRegisterClient } from "./daily-register-client";
import { ShareQrCode } from "./share-qr-code";
import { TaskQueueTable } from "./task-queue-table";

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
    db.washerTask
      .findMany({
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
      })
      .catch((err: unknown) => {
        if (!isSchemaNotReadyError(err)) throw err;
        return [];
      }),
  ]);

  // Daily register: date-filtered list
  const registerDate = params.registerDate
    ? new Date(params.registerDate)
    : new Date();
  const registerDateStr = format(registerDate, "yyyy-MM-dd");

  const dailyTasks = await db.washerTask
    .findMany({
      where: {
        workspaceId: workspace.id,
        createdAt: {
          gte: startOfDay(registerDate),
          lte: endOfDay(registerDate),
        },
      },
      include: { vehicle: true, washer: true },
      orderBy: { createdAt: "desc" },
    })
    .catch((err: unknown) => {
      if (!isSchemaNotReadyError(err)) throw err;
      return [];
    });

  // ─── KPI Computation ─────────────────────────────────────────────────────
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todayTasks = dailyTasks.filter(
    (t) => t.createdAt >= todayStart && t.createdAt <= todayEnd,
  );
  const kpi = {
    total: todayTasks.length,
    done: todayTasks.filter((t) => t.status === WasherTaskStatus.DONE).length,
    pending: todayTasks.filter(
      (t) => t.status === WasherTaskStatus.TODO || t.status === WasherTaskStatus.IN_PROGRESS,
    ).length,
    blocked: todayTasks.filter((t) => t.status === WasherTaskStatus.BLOCKED).length,
    avgTurnaround: (() => {
      const completed = todayTasks.filter((t) => t.status === WasherTaskStatus.DONE);
      if (completed.length === 0) return 0;
      const totalMin = completed.reduce(
        (sum, t) => sum + differenceInMinutes(t.updatedAt, t.createdAt),
        0,
      );
      return Math.round(totalMin / completed.length);
    })(),
    slaBreaches: (() => {
      const SLA_MINUTES = 45;
      return todayTasks.filter((t) => {
        if (t.status === WasherTaskStatus.DONE) {
          return differenceInMinutes(t.updatedAt, t.createdAt) > SLA_MINUTES;
        }
        if (t.status === WasherTaskStatus.TODO || t.status === WasherTaskStatus.IN_PROGRESS) {
          return differenceInMinutes(new Date(), t.createdAt) > SLA_MINUTES;
        }
        return false;
      }).length;
    })(),
    topWashers: (() => {
      const counts = new Map<string, number>();
      for (const t of todayTasks) {
        const name = t.washer?.name ?? "Kiosk";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    })(),
  };

  const kioskToken = process.env.KIOSK_TOKEN ?? "";
  const kioskStationId = process.env.KIOSK_STATION_ID ?? "default";
  const hasKioskToken = kioskToken.length > 0;

  return (
    <div className="space-y-6" data-testid="washers-page">
      <PageHeader
        title="Washer Operations"
        subtitle="Fast clean-task logging for exterior/interior/vacuum with optional voice notes."
        action={
          <Button asChild variant="outline">
            <Link href="/washers/app" target="_blank" rel="noopener noreferrer">Open Kiosk App</Link>
          </Button>
        }
      />

      <StatusBanner error={params.error} success={params.success} />

      {/* ─── KPI Dashboard ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" data-testid="washers-kpis">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-[var(--accent)]">{kpi.total}</p>
          <p className="text-xs text-[var(--text-muted)]">Today Tasks</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{kpi.done}</p>
          <p className="text-xs text-[var(--text-muted)]">Completed</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{kpi.pending}</p>
          <p className="text-xs text-[var(--text-muted)]">Pending</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-rose-400">{kpi.blocked}</p>
          <p className="text-xs text-[var(--text-muted)]">Issues</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text)]">{kpi.avgTurnaround}m</p>
          <p className="text-xs text-[var(--text-muted)]">Avg Turnaround</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className={`text-2xl font-bold ${kpi.slaBreaches > 0 ? "text-rose-400" : "text-emerald-400"}`}>{kpi.slaBreaches}</p>
          <p className="text-xs text-[var(--text-muted)]">SLA Breaches</p>
        </GlassCard>
      </div>

      {/* ─── Top Washers ─────────────────────────────────────────────── */}
      {kpi.topWashers.length > 0 && (
        <GlassCard className="space-y-2 p-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)]">Top Washers Today</h3>
          <div className="flex flex-wrap gap-3">
            {kpi.topWashers.map(([name, count]) => (
              <span key={name} className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 text-sm text-[var(--text)]">
                {name}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ─── Share Washer App Panel ──────────────────────────────────── */}
      <GlassCard className="space-y-3 p-4" data-testid="share-washer-app">
        <h3 className="kpi-font text-lg font-semibold">Share Washer App</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Share this link with your washers. They can open it on any device — no login required.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 rounded border border-[var(--border)] bg-white/5 px-3 py-2 text-xs text-[var(--text)]">
            {typeof window !== "undefined"
              ? `${window.location.origin}/washers/app?kiosk=${hasKioskToken ? "***" : "NOT_SET"}&station=${kioskStationId}`
              : `/washers/app?kiosk=${hasKioskToken ? "***" : "NOT_SET"}&station=${kioskStationId}`}
          </code>
          <Button variant="outline" className="h-9 text-xs" asChild>
            <Link href="/washers/app" target="_blank">Open Preview</Link>
          </Button>
        </div>
        <div className="text-xs text-[var(--text-muted)] space-y-1">
          <p>📱 <strong>iOS</strong>: Open in Safari → Share → Add to Home Screen</p>
          <p>🤖 <strong>Android</strong>: Open in Chrome → Menu → Install App</p>
          <p>🖥️ <strong>Desktop</strong>: Open in Chrome → Address bar install icon</p>
        </div>
        <ShareQrCode url={`/washers/app?kiosk=${hasKioskToken ? "TOKEN" : "NOT_SET"}&station=${kioskStationId}`} />
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block size-2 rounded-full ${hasKioskToken ? "bg-emerald-400" : "bg-rose-400"}`} />
          <span className="text-[var(--text-muted)]">
            Kiosk Token: {hasKioskToken ? "Configured ✓" : "Not Set — washers will be in read-only mode"}
          </span>
        </div>
      </GlassCard>

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
          <TaskQueueTable
            workspaceId={workspace.id}
            canWrite={canWrite}
            tasks={tasks.map((task) => ({
              id: task.id,
              plate: task.vehicle.plateNumber,
              model: task.vehicle.model,
              status: task.status,
              washer: task.washer?.name ?? "Unassigned",
              time: format(task.createdAt, "HH:mm"),
              exteriorDone: task.exteriorDone,
              interiorDone: task.interiorDone,
              vacuumDone: task.vacuumDone,
              notes: task.notes ?? "",
            }))}
          />
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

        <DailyRegisterClient
          workspaceId={workspace.id}
          canWrite={canWrite}
          tasks={dailyTasks.map((t) => ({
            id: t.id,
            plate: t.vehicle.plateNumber,
            model: t.vehicle.model,
            status: t.status,
            exteriorDone: t.exteriorDone,
            interiorDone: t.interiorDone,
            vacuumDone: t.vacuumDone,
            washer: t.washer?.name ?? "Kiosk",
            station: t.stationId ?? "—",
            time: format(t.createdAt, "HH:mm"),
          }))}
        />
      </GlassCard>
    </div>
  );
}
