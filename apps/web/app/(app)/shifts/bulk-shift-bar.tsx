"use client";

import { ShiftStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { pushUndo } from "@/components/kit/inline-edit";
import { PrimaryButton } from "@/components/kit/primary-button";

import { bulkUpdateShiftsAction } from "./bulk-actions";
import { ShiftInlineField } from "./shift-inline-field";

type ShiftRow = {
  id: string;
  title: string;
  status: string;
  assignedTo: string;
  startsAt: string;
  endsAt: string;
};

type BulkShiftBarProps = {
  shifts: ShiftRow[];
  workspaceId: string;
  canWrite?: boolean | undefined;
};

export function BulkShiftBar({ shifts, workspaceId, canWrite }: BulkShiftBarProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [optimisticShifts, setOptimisticShifts] = useOptimistic(
    shifts,
    (state, update: { ids: string[]; status: string }) =>
      state.map((s) => (update.ids.includes(s.id) ? { ...s, status: update.status } : s)),
  );

  const toggleAll = () => {
    if (selected.size === optimisticShifts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(optimisticShifts.map((s) => s.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const bulkAction = (targetStatus: ShiftStatus) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      setOptimisticShifts({ ids, status: targetStatus });

      const result = await bulkUpdateShiftsAction({
        workspaceId,
        shiftIds: ids,
        targetStatus,
      });

      if (result.ok) {
        setMessage(`${result.count} shifts → ${targetStatus}`);
        setSelected(new Set());

        // Push undo entry
        pushUndo({
          id: `bulk-shifts-${Date.now()}`,
          label: `Undo bulk ${targetStatus.toLowerCase()}`,
          undo: async () => {
            // Restore each shift to its previous status
            for (const prev of result.previous) {
              await bulkUpdateShiftsAction({
                workspaceId,
                shiftIds: [prev.id],
                targetStatus: prev.status,
              });
            }
            router.refresh();
          },
        });

        router.refresh();
      } else {
        setMessage(`Error: ${result.error}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2">
          <span className="text-sm font-medium text-[var(--text)]">
            {selected.size} selected
          </span>
          <PrimaryButton
            type="button"
            onClick={() => bulkAction(ShiftStatus.PUBLISHED)}
            disabled={isPending}
          >
            Publish
          </PrimaryButton>
          <PrimaryButton
            type="button"
            onClick={() => bulkAction(ShiftStatus.LOCKED)}
            disabled={isPending}
          >
            Lock
          </PrimaryButton>
          <button
            type="button"
            onClick={() => bulkAction(ShiftStatus.CANCELLED)}
            disabled={isPending}
            className="focus-ring rounded-[var(--radius-sm)] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-emerald-400">{message}</p>
      ) : null}

      {/* Shift list with checkboxes */}
      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] bg-white/5">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === optimisticShifts.length && optimisticShifts.length > 0}
                  onChange={toggleAll}
                  className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Title</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Assignee</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Time</th>
            </tr>
          </thead>
          <tbody>
            {optimisticShifts.map((shift) => (
              <tr
                key={shift.id}
                className={`border-b border-[var(--border)]/50 ${selected.has(shift.id) ? "bg-[var(--accent)]/10" : "hover:bg-white/5"}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(shift.id)}
                    onChange={() => toggle(shift.id)}
                    className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-[var(--text)]">
                  {canWrite ? (
                    <ShiftInlineField
                      workspaceId={workspaceId}
                      shiftId={shift.id}
                      field="title"
                      value={shift.title}
                      placeholder="Shift title"
                    />
                  ) : (
                    shift.title
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{shift.assignedTo}</td>
                <td className="px-3 py-2">
                  <StatusChip status={shift.status} />
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted)] tabular-nums">
                  {new Date(shift.startsAt).toLocaleDateString()} {new Date(shift.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
            {optimisticShifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                  No shifts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === "PUBLISHED"
      ? "text-emerald-400 bg-emerald-500/15"
      : status === "LOCKED"
        ? "text-blue-400 bg-blue-500/15"
        : status === "DRAFT"
          ? "text-amber-400 bg-amber-500/15"
          : "text-red-400 bg-red-500/15";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}
