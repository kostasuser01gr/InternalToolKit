import { addDays, format, isAfter, isBefore, startOfDay } from "date-fns";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { hasWorkspacePermission } from "@/lib/rbac";
import { calendarRangeSchema } from "@/lib/validators/calendar";

type CalendarPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    from?: string;
    to?: string;
  }>;
};

type CalendarEventItem = {
  id: string;
  at: Date;
  title: string;
  detail: string;
  type: "shift" | "request" | "vehicle" | "washer";
};

function parseDateInput(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const { workspace, workspaceRole } = await getAppContext(params.workspaceId);

  const canRead = hasWorkspacePermission(workspaceRole, "calendar", "read");

  if (!canRead) {
    return (
      <GlassCard className="space-y-3" data-testid="calendar-blocked">
        <h1 className="kpi-font text-2xl font-semibold">Calendar access required</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your role does not include shared calendar access.
        </p>
      </GlassCard>
    );
  }

  const defaultFrom = startOfDay(new Date());
  const defaultTo = addDays(defaultFrom, 14);

  const parsedRange = calendarRangeSchema.parse({
    workspaceId: workspace.id,
    from: params.from,
    to: params.to,
  });

  const fromDate = parseDateInput(parsedRange.from, defaultFrom);
  const toDate = parseDateInput(parsedRange.to, defaultTo);

  function schemaFallback<T>(fallback: T) {
    return (err: unknown): T => {
      if (!isSchemaNotReadyError(err)) throw err;
      return fallback;
    };
  }

  type ShiftWithAssignee = Awaited<ReturnType<typeof db.shift.findMany<{ include: { assignee: true } }>>>;
  type ShiftRequestWithRequester = Awaited<ReturnType<typeof db.shiftRequest.findMany<{ include: { requester: true } }>>>;
  type VehicleEventWithVehicle = Awaited<ReturnType<typeof db.vehicleEvent.findMany<{ include: { vehicle: true } }>>>;
  type WasherTaskWithRelations = Awaited<ReturnType<typeof db.washerTask.findMany<{ include: { vehicle: true; washer: true } }>>>;

  const [shifts, requests, vehicleEvents, washerTasks] = await Promise.all([
    db.shift
      .findMany({
        where: {
          workspaceId: workspace.id,
          startsAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          assignee: true,
        },
        orderBy: {
          startsAt: "asc",
        },
      })
      .catch(schemaFallback([] as ShiftWithAssignee)),
    db.shiftRequest
      .findMany({
        where: {
          workspaceId: workspace.id,
          startsAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          requester: true,
        },
        orderBy: {
          startsAt: "asc",
        },
      })
      .catch(schemaFallback([] as ShiftRequestWithRequester)),
    db.vehicleEvent
      .findMany({
        where: {
          workspaceId: workspace.id,
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          vehicle: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })
      .catch(schemaFallback([] as VehicleEventWithVehicle)),
    db.washerTask
      .findMany({
        where: {
          workspaceId: workspace.id,
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          vehicle: true,
          washer: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })
      .catch(schemaFallback([] as WasherTaskWithRelations)),
  ]);

  const events: CalendarEventItem[] = [
    ...shifts.map((shift) => ({
      id: `shift:${shift.id}`,
      at: shift.startsAt,
      title: `Shift · ${shift.title}`,
      detail: `${shift.assignee?.name ?? "Unassigned"} · ${shift.status}`,
      type: "shift" as const,
    })),
    ...requests.map((request) => ({
      id: `request:${request.id}`,
      at: request.startsAt,
      title: `Request · ${request.type}`,
      detail: `${request.requester.name} · ${request.status}`,
      type: "request" as const,
    })),
    ...vehicleEvents.map((event) => ({
      id: `vehicle:${event.id}`,
      at: event.createdAt,
      title: `Fleet · ${event.type}`,
      detail: `${event.vehicle.plateNumber} ${event.valueText ? `· ${event.valueText}` : ""}`,
      type: "vehicle" as const,
    })),
    ...washerTasks.map((task) => ({
      id: `washer:${task.id}`,
      at: task.createdAt,
      title: `Washer · ${task.status}`,
      detail: `${task.vehicle.plateNumber} · ${task.washer?.name ?? "Unassigned"}`,
      type: "washer" as const,
    })),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());

  const grouped = new Map<string, CalendarEventItem[]>();
  for (const event of events) {
    if (isBefore(event.at, fromDate) || isAfter(event.at, toDate)) {
      continue;
    }

    const dayKey = format(event.at, "yyyy-MM-dd");
    const existing = grouped.get(dayKey);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(dayKey, [event]);
    }
  }

  const days = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <PageHeader
        title="Calendar & Requests"
        subtitle="Shared timeline for shifts, requests, fleet events and washer operations."
      />

      <GlassCard className="space-y-3">
        <form method="get" className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <div className="space-y-1">
            <Label htmlFor="calendar-from">From</Label>
            <Input id="calendar-from" name="from" type="date" defaultValue={format(fromDate, "yyyy-MM-dd")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="calendar-to">To</Label>
            <Input id="calendar-to" name="to" type="date" defaultValue={format(toDate, "yyyy-MM-dd")} />
          </div>
          <div className="flex items-end">
            <PrimaryButton type="submit" className="w-full">
              Apply range
            </PrimaryButton>
          </div>
        </form>
      </GlassCard>

      <GlassCard className="space-y-4">
        {days.map(([day, dayEvents]) => (
          <section key={day} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <h2 className="kpi-font mb-2 text-lg font-semibold">{format(new Date(day), "EEEE, dd MMM yyyy")}</h2>
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-white/6 px-3 py-2"
                >
                  <p className="text-sm font-medium text-[var(--text)]">{event.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {format(event.at, "HH:mm")} · {event.detail}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}

        {days.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No events in selected range.</p>
        ) : null}
      </GlassCard>
    </div>
  );
}
