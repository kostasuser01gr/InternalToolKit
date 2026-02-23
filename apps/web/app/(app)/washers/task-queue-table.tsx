"use client";

import { WasherTaskStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { pushUndo } from "@/components/kit/inline-edit";
import { VirtualTable, type VirtualTableColumn } from "@/components/kit/virtual-table";

import { updateWasherTaskAction } from "./actions";

type TaskRow = {
  id: string;
  plate: string;
  model: string;
  status: WasherTaskStatus;
  washer: string;
  time: string;
  exteriorDone: boolean;
  interiorDone: boolean;
  vacuumDone: boolean;
  notes: string;
};

type TaskQueueTableProps = {
  tasks: TaskRow[];
  workspaceId: string;
  canWrite: boolean;
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "DONE"
      ? "bg-emerald-400"
      : status === "IN_PROGRESS"
        ? "bg-amber-400"
        : status === "BLOCKED"
          ? "bg-rose-400"
          : "bg-white/40";
  return <span className={`inline-block size-2 rounded-full ${color}`} />;
}

export function TaskQueueTable({ tasks, workspaceId, canWrite }: TaskQueueTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [optimisticTasks, setOptimisticTask] = useOptimistic(
    tasks,
    (state, update: { id: string; status: WasherTaskStatus }) =>
      state.map((t) => (t.id === update.id ? { ...t, status: update.status } : t)),
  );

  const columns: VirtualTableColumn<TaskRow>[] = [
    { key: "plate", header: "Vehicle", width: "130px", render: (r) => <span className="font-medium">{r.plate}</span> },
    { key: "model", header: "Model", render: (r) => r.model },
    { key: "status", header: "Status", width: "100px", render: (r) => (
      <span className="flex items-center gap-1.5 text-xs">
        <StatusDot status={r.status} />
        {r.status}
      </span>
    )},
    { key: "washer", header: "Washer", width: "110px", render: (r) => r.washer },
    { key: "checks", header: "Checks", width: "90px", render: (r) => (
      <span className="text-xs tabular-nums">
        {[r.exteriorDone && "E", r.interiorDone && "I", r.vacuumDone && "V"].filter(Boolean).join("·") || "—"}
      </span>
    )},
    { key: "time", header: "Time", width: "60px", render: (r) => <span className="text-xs tabular-nums">{r.time}</span> },
  ];

  const handleRowClick = (row: TaskRow) => {
    setExpandedId(expandedId === row.id ? null : row.id);
  };

  const handleQuickStatus = (task: TaskRow, newStatus: WasherTaskStatus) => {
    const prevStatus = task.status;
    startTransition(async () => {
      setOptimisticTask({ id: task.id, status: newStatus });

      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("taskId", task.id);
      fd.set("status", newStatus);
      fd.set("notes", task.notes);
      if (task.exteriorDone) fd.set("exteriorDone", "on");
      if (task.interiorDone) fd.set("interiorDone", "on");
      if (task.vacuumDone) fd.set("vacuumDone", "on");

      try {
        await updateWasherTaskAction(fd);
      } catch {
        // Revert optimistic update on error
        setOptimisticTask({ id: task.id, status: prevStatus });
        return;
      }

      pushUndo({
        id: `task-status-${task.id}-${Date.now()}`,
        label: `Undo ${task.plate} → ${newStatus}`,
        undo: async () => {
          const revert = new FormData();
          revert.set("workspaceId", workspaceId);
          revert.set("taskId", task.id);
          revert.set("status", prevStatus);
          revert.set("notes", task.notes);
          if (task.exteriorDone) revert.set("exteriorDone", "on");
          if (task.interiorDone) revert.set("interiorDone", "on");
          if (task.vacuumDone) revert.set("vacuumDone", "on");
          await updateWasherTaskAction(revert);
          router.refresh();
        },
      });

      router.refresh();
    });
  };

  const expanded = expandedId ? optimisticTasks.find((t) => t.id === expandedId) : null;

  return (
    <div className="space-y-3">
      <VirtualTable
        data={optimisticTasks}
        columns={columns}
        rowHeight={40}
        maxHeight={360}
        onRowClick={handleRowClick}
        emptyMessage="No washer tasks yet."
      />

      {/* Expanded quick-action panel */}
      {expanded && canWrite ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            {expanded.plate} · {expanded.model} — Quick Status
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.values(WasherTaskStatus).map((s) => (
              <button
                key={s}
                type="button"
                disabled={isPending || expanded.status === s}
                onClick={() => handleQuickStatus(expanded, s)}
                className={`focus-ring rounded-full px-3 py-1 text-xs font-medium border ${
                  expanded.status === s
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-[var(--border)] bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Notes: {expanded.notes || "—"} · {expanded.time}
          </p>
        </div>
      ) : null}
    </div>
  );
}
