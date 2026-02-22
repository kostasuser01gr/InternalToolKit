"use client";

import { useCallback, useState, useTransition } from "react";

import {
  bulkUpdateWasherTasksAction,
  undoWasherTasksAction,
  type BulkUpdateResult,
} from "@/app/(app)/washers/actions";

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

        // Auto-dismiss undo after timeout
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

  return (
    <div className="space-y-3" data-testid="daily-register-client">
      {/* Bulk action bar */}
      {canWrite && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2">
          <span className="text-sm font-medium text-purple-200">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => handleBulkAction("DONE")}
            disabled={isPending}
            className="rounded-md bg-emerald-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            ✓ Mark Done
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction("IN_PROGRESS")}
            disabled={isPending}
            className="rounded-md bg-blue-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            ▶ In Progress
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction("BLOCKED")}
            disabled={isPending}
            className="rounded-md bg-rose-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            ⚠ Block
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Clear
          </button>
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

      {/* Data table */}
      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)]/95 backdrop-blur">
            <tr className="border-b border-[var(--border)]">
              {canWrite && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === tasks.length && tasks.length > 0}
                    onChange={toggleAll}
                    className="accent-purple-500"
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Vehicle</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Status</th>
              <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-[var(--text-muted)]">Ext</th>
              <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-[var(--text-muted)]">Int</th>
              <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-[var(--text-muted)]">Vac</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Washer</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Station</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Time</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={`border-b border-[var(--border)]/50 transition-colors ${
                  selected.has(task.id)
                    ? "bg-purple-500/10"
                    : "hover:bg-white/3"
                }`}
              >
                {canWrite && (
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() => toggleOne(task.id)}
                      className="accent-purple-500"
                    />
                  </td>
                )}
                <td className="px-3 py-2 font-medium text-[var(--text)]">
                  {task.plate} · {task.model}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      task.status === "DONE"
                        ? "bg-emerald-400/20 text-emerald-300"
                        : task.status === "IN_PROGRESS"
                          ? "bg-blue-400/20 text-blue-300"
                          : task.status === "BLOCKED"
                            ? "bg-rose-400/20 text-rose-300"
                            : "bg-amber-400/20 text-amber-300"
                    }`}
                  >
                    {task.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">{task.exteriorDone ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center">{task.interiorDone ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center">{task.vacuumDone ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{task.washer}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{task.station}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{task.time}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={canWrite ? 9 : 8}
                  className="py-8 text-center text-sm text-[var(--text-muted)]"
                >
                  No tasks for this day
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
