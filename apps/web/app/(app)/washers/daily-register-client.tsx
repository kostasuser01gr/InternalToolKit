"use client";

import { useCallback, useState, useTransition } from "react";

import {
  bulkUpdateWasherTasksAction,
  undoWasherTasksAction,
  type BulkUpdateResult,
} from "@/app/(app)/washers/actions";
import { VirtualTable, type VirtualTableColumn } from "@/components/kit/virtual-table";

type TaskRow = {
  id: string;
  plate: string;
  model: string;
  status: string;
  exteriorDone: boolean;
  interiorDone: boolean;
  vacuumDone: boolean;
  washer: string;
  station: string;
  time: string;
};

type DailyRegisterClientProps = {
  workspaceId: string;
  tasks: TaskRow[];
  canWrite: boolean;
};

const UNDO_TIMEOUT_MS = 15_000;

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "DONE"
      ? "bg-emerald-400/20 text-emerald-300"
      : status === "IN_PROGRESS"
        ? "bg-blue-400/20 text-blue-300"
        : status === "BLOCKED"
          ? "bg-rose-400/20 text-rose-300"
          : "bg-amber-400/20 text-amber-300";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

export function DailyRegisterClient({
  workspaceId,
  tasks,
  canWrite,
}: DailyRegisterClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undoState, setUndoState] = useState<BulkUpdateResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const toggleAll = useCallback(() => {
    if (selected.size === tasks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tasks.map((t) => t.id)));
    }
  }, [selected.size, tasks]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleBulkAction(status: string) {
    if (selected.size === 0 || !canWrite) return;

    startTransition(async () => {
      const result = await bulkUpdateWasherTasksAction({
        workspaceId,
        taskIds: Array.from(selected),
        status: status as "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED",
      });

      if (result.ok) {
        setMessage({
          type: "success",
          text: `Updated ${result.updated} task(s) to ${status}`,
        });
        setUndoState(result);
        setSelected(new Set());

        setTimeout(() => {
          setUndoState((current) =>
            current === result ? null : current,
          );
        }, UNDO_TIMEOUT_MS);
      } else {
        setMessage({ type: "error", text: result.error ?? "Bulk update failed" });
      }
    });
  }

  async function handleUndo() {
    if (!undoState) return;

    startTransition(async () => {
      const result = await undoWasherTasksAction(
        workspaceId,
        undoState.previousStates,
      );

      if (result.ok) {
        setMessage({
          type: "success",
          text: `Restored ${result.restored} task(s)`,
        });
      } else {
        setMessage({ type: "error", text: result.error ?? "Undo failed" });
      }
      setUndoState(null);
    });
  }

  const columns: VirtualTableColumn<TaskRow>[] = [
    ...(canWrite
      ? [{
          key: "select",
          header: "",
          width: "36px",
          render: (r: TaskRow) => (
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggleOne(r.id)}
              onClick={(e) => e.stopPropagation()}
              className="accent-purple-500 size-4"
            />
          ),
        } satisfies VirtualTableColumn<TaskRow>]
      : []),
    { key: "vehicle", header: "Vehicle", width: "160px", render: (r) => <span className="font-medium">{r.plate} · {r.model}</span> },
    { key: "status", header: "Status", width: "100px", render: (r) => <StatusBadge status={r.status} /> },
    { key: "ext", header: "Ext", width: "40px", render: (r) => <span className="text-center block">{r.exteriorDone ? "✓" : "—"}</span> },
    { key: "int", header: "Int", width: "40px", render: (r) => <span className="text-center block">{r.interiorDone ? "✓" : "—"}</span> },
    { key: "vac", header: "Vac", width: "40px", render: (r) => <span className="text-center block">{r.vacuumDone ? "✓" : "—"}</span> },
    { key: "washer", header: "Washer", width: "100px", render: (r) => <span className="text-[var(--text-muted)]">{r.washer}</span> },
    { key: "station", header: "Station", width: "80px", render: (r) => <span className="text-[var(--text-muted)]">{r.station}</span> },
    { key: "time", header: "Time", width: "60px", render: (r) => <span className="text-[var(--text-muted)] tabular-nums">{r.time}</span> },
  ];

  return (
    <div className="space-y-3" data-testid="daily-register-client">
      {/* Select-all + Bulk action bar */}
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={selected.size === tasks.length && tasks.length > 0}
              onChange={toggleAll}
              className="accent-purple-500 size-4"
            />
            Select all
          </label>

          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-1.5">
              <span className="text-xs font-medium text-purple-200">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={() => handleBulkAction("DONE")}
                disabled={isPending}
                className="rounded-md bg-emerald-600/80 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                ✓ Done
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("IN_PROGRESS")}
                disabled={isPending}
                className="rounded-md bg-blue-600/80 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                ▶ Progress
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("BLOCKED")}
                disabled={isPending}
                className="rounded-md bg-rose-600/80 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                ⚠ Block
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Undo bar */}
      {undoState && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
          <span className="text-sm text-amber-200">
            {undoState.updated} task(s) updated
          </span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isPending}
            className="rounded-md bg-amber-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            ↩ Undo
          </button>
        </div>
      )}

      {/* Status/error message */}
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === "success"
              ? "border border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
              : "border border-rose-400/20 bg-rose-400/5 text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Virtualized table */}
      <VirtualTable
        data={tasks}
        columns={columns}
        rowHeight={40}
        maxHeight={500}
        emptyMessage="No tasks for this day"
      />
    </div>
  );
}
