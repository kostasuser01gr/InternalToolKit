import { ShiftRequestStatus, ShiftRequestType, ShiftStatus } from "@prisma/client";
import { format } from "date-fns";
import Link from "next/link";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { ShiftBoard } from "@/components/modules/shifts/shift-board";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { hasWorkspacePermission } from "@/lib/rbac";

import {
  createShiftAction,
  createShiftRequestAction,
  importShiftsCsvAction,
  reviewShiftRequestAction,
} from "./actions";

type ShiftsPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    error?: string;
    success?: string;
  }>;
};

function toDateTimeLocalValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export default async function ShiftsPage({ searchParams }: ShiftsPageProps) {
  const params = await searchParams;
  const { workspace, workspaceRole } = await getAppContext(params.workspaceId);

  const canRead = hasWorkspacePermission(workspaceRole, "shifts", "read");
  const canWrite = hasWorkspacePermission(workspaceRole, "shifts", "write");
  const canApprove = hasWorkspacePermission(
    workspaceRole,
    "shifts",
    "approve_requests",
  );

  if (!canRead) {
    return (
      <GlassCard data-testid="shifts-blocked" className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Shift planner access required</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your role does not include access to shift planning.
        </p>
      </GlassCard>
    );
  }

  const [members, shifts, shiftRequests] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    }),
    db.shift.findMany({
      where: { workspaceId: workspace.id },
      include: {
        assignee: true,
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 200,
    }),
    db.shiftRequest.findMany({
      where: { workspaceId: workspace.id },
      include: {
        requester: true,
        shift: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 8 * 60 * 60 * 1000);

  return (
    <div className="space-y-6" data-testid="shifts-page">
      <PageHeader
        title="Shift Planner"
        subtitle="Excel-like weekly scheduling with drag-and-drop moves, conflict checks, and CSV import/export."
        action={
          <Link
            href={`/shifts/export?workspaceId=${workspace.id}`}
            className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Export CSV
          </Link>
        }
      />

      <StatusBanner error={params.error} success={params.success} />

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Weekly Board</h2>
        <ShiftBoard
          workspaceId={workspace.id}
          shifts={shifts.map((shift) => ({
            id: shift.id,
            title: shift.title,
            status: shift.status,
            assignedTo:
              shift.assignee?.name ?? shift.assignee?.loginName ?? "Unassigned",
            startsAt: shift.startsAt.toISOString(),
            endsAt: shift.endsAt.toISOString(),
          }))}
        />
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Create Shift</h2>
          <form action={createShiftAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <div className="space-y-1">
              <Label htmlFor="shift-title">Title</Label>
              <Input id="shift-title" name="title" required placeholder="Morning arrivals" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="shift-assignee">Assigned user</Label>
              <select
                id="shift-assignee"
                name="assignedUserId"
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                defaultValue=""
                disabled={!canWrite}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="shift-startsAt">Starts at</Label>
                <Input
                  id="shift-startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(defaultStart)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shift-endsAt">Ends at</Label>
                <Input
                  id="shift-endsAt"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(defaultEnd)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="shift-status">Status</Label>
              <select
                id="shift-status"
                name="status"
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                defaultValue={ShiftStatus.PUBLISHED}
              >
                {Object.values(ShiftStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="shift-notes">Notes</Label>
              <Textarea id="shift-notes" name="notes" rows={3} placeholder="Staffing notes" />
            </div>

            <PrimaryButton type="submit" disabled={!canWrite}>
              Create shift
            </PrimaryButton>
          </form>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Import shifts (CSV)</h2>
          <form action={importShiftsCsvAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <p className="text-xs text-[var(--text-muted)]">
              CSV columns: <code>title</code>, <code>startsAt</code>, <code>endsAt</code>, optional <code>assignedLoginName</code>, <code>notes</code>.
            </p>
            <Input name="file" type="file" accept=".csv,text/csv" required disabled={!canWrite} />
            <PrimaryButton type="submit" disabled={!canWrite}>
              Import CSV
            </PrimaryButton>
          </form>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3 text-sm">
            <h3 className="mb-2 font-medium text-[var(--text)]">Recent shifts</h3>
            <div className="space-y-2">
              {shifts.slice(0, 8).map((shift) => (
                <article key={shift.id} className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-white/5 px-2 py-1.5">
                  <p className="font-medium text-[var(--text)]">{shift.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {format(shift.startsAt, "EEE d MMM HH:mm")} - {format(shift.endsAt, "HH:mm")}
                  </p>
                </article>
              ))}
              {shifts.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No shifts yet.</p>
              ) : null}
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Request time changes</h2>
          <form action={createShiftRequestAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />

            <div className="space-y-1">
              <Label htmlFor="request-shift">Linked shift (optional)</Label>
              <select
                id="request-shift"
                name="shiftId"
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                defaultValue=""
              >
                <option value="">None</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.title} · {format(shift.startsAt, "dd/MM HH:mm")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="request-type">Request type</Label>
              <select
                id="request-type"
                name="type"
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                defaultValue={ShiftRequestType.TIME_OFF}
              >
                {Object.values(ShiftRequestType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="request-startsAt">Starts at</Label>
                <Input
                  id="request-startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(defaultStart)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="request-endsAt">Ends at</Label>
                <Input
                  id="request-endsAt"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(defaultEnd)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="request-reason">Reason</Label>
              <Textarea id="request-reason" name="reason" rows={3} required />
            </div>

            <PrimaryButton type="submit">Submit request</PrimaryButton>
          </form>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Shift requests</h2>
          <div className="space-y-2">
            {shiftRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium text-[var(--text)]">
                    {request.type} · {request.requester.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{request.status}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {format(request.startsAt, "dd MMM HH:mm")} - {format(request.endsAt, "dd MMM HH:mm")}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{request.reason}</p>

                {canApprove && request.status === ShiftRequestStatus.PENDING ? (
                  <div className="mt-3 flex gap-2">
                    <form action={reviewShiftRequestAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <PrimaryButton type="submit">Approve</PrimaryButton>
                    </form>
                    <form action={reviewShiftRequestAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button
                        type="submit"
                        className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
            {shiftRequests.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No requests yet.</p>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
