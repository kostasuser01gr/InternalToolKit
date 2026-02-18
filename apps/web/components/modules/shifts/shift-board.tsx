"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type ShiftBoardItem = {
  id: string;
  title: string;
  status: string;
  assignedTo: string;
  startsAt: string;
  endsAt: string;
};

type ShiftBoardProps = {
  workspaceId: string;
  shifts: ShiftBoardItem[];
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekDates() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function ShiftBoard({ workspaceId, shifts }: ShiftBoardProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [movingShiftId, setMovingShiftId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const days = useMemo(() => getWeekDates(), []);
  const grouped = useMemo(() => {
    const bucket = new Map<string, ShiftBoardItem[]>();

    for (const shift of shifts) {
      const key = shift.startsAt.slice(0, 10);
      const existing = bucket.get(key);
      if (existing) {
        existing.push(shift);
      } else {
        bucket.set(key, [shift]);
      }
    }

    return bucket;
  }, [shifts]);

  async function moveShift(shiftId: string, targetDateIso: string) {
    setMovingShiftId(shiftId);
    setMessage(null);

    try {
      const response = await fetch(`/api/shifts/${shiftId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          targetDateIso,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setMessage(payload?.message ?? "Unable to move shift.");
        return;
      }

      setMessage("Shift moved.");
      router.refresh();
    } catch {
      setMessage("Unable to move shift.");
    } finally {
      setMovingShiftId(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="shifts-board">
      {message ? (
        <p className="text-sm text-[var(--text-muted)]" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-7">
        {days.map((day) => {
          const dayKey = toDateKey(day);
          const dayShifts = grouped.get(dayKey) ?? [];

          return (
            <section
              key={dayKey}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const shiftId = event.dataTransfer.getData("text/plain");
                if (!shiftId) {
                  return;
                }

                startTransition(() => {
                  void moveShift(shiftId, dayKey);
                });
              }}
              className={cn(
                "rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3",
                isPending && "opacity-80",
              )}
            >
              <header className="mb-3 border-b border-[var(--border)] pb-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {weekdayFormatter.format(day)}
                </h3>
              </header>

              <div className="space-y-2">
                {dayShifts.map((shift) => (
                  <article
                    key={shift.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", shift.id);
                    }}
                    className={cn(
                      "cursor-move rounded-[var(--radius-xs)] border border-[#9a6fff55] bg-[#9a6fff1d] p-2 text-xs text-[var(--text)]",
                      movingShiftId === shift.id && "opacity-60",
                    )}
                  >
                    <p className="font-medium">{shift.title}</p>
                    <p className="text-[var(--text-muted)]">{shift.assignedTo}</p>
                    <p className="text-[var(--text-muted)]">
                      {timeFormatter.format(new Date(shift.startsAt))} -{" "}
                      {timeFormatter.format(new Date(shift.endsAt))}
                    </p>
                    <p className="mt-1 text-[10px] tracking-wide text-[var(--text-muted)] uppercase">
                      {shift.status}
                    </p>
                  </article>
                ))}
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">Drop shift here</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { ShiftBoard };
