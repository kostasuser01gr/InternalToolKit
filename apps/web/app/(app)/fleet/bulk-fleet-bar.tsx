"use client";

import { VehicleStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { pushUndo } from "@/components/kit/inline-edit";
import { PrimaryButton } from "@/components/kit/primary-button";

import { bulkUpdateVehiclesAction } from "./actions";

type VehicleRow = {
  id: string;
  plateNumber: string;
  model: string;
  status: string;
};

type BulkFleetBarProps = {
  vehicles: VehicleRow[];
  workspaceId: string;
};

const BULK_TARGETS: VehicleStatus[] = [
  VehicleStatus.NEEDS_CLEANING,
  VehicleStatus.CLEANING,
  VehicleStatus.QC_PENDING,
  VehicleStatus.READY,
  VehicleStatus.OUT_OF_SERVICE,
];

export function BulkFleetBar({ vehicles, workspaceId }: BulkFleetBarProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [optimisticVehicles, setOptimisticVehicles] = useOptimistic(
    vehicles,
    (state, update: { ids: string[]; status: string }) =>
      state.map((v) => (update.ids.includes(v.id) ? { ...v, status: update.status } : v)),
  );

  const toggleAll = () => {
    if (selected.size === optimisticVehicles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(optimisticVehicles.map((v) => v.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const bulkAction = (targetStatus: VehicleStatus) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      setOptimisticVehicles({ ids, status: targetStatus });

      const result = await bulkUpdateVehiclesAction({
        workspaceId,
        vehicleIds: ids,
        targetStatus,
      });

      if (result.ok) {
        setMessage(`${result.count} vehicles → ${targetStatus}`);
        setSelected(new Set());

        pushUndo({
          id: `bulk-fleet-${Date.now()}`,
          label: `Undo bulk ${targetStatus.toLowerCase().replace(/_/g, " ")}`,
          undo: async () => {
            for (const prev of result.previous) {
              await bulkUpdateVehiclesAction({
                workspaceId,
                vehicleIds: [prev.id],
                targetStatus: prev.status as VehicleStatus,
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
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2">
          <span className="text-sm font-medium text-[var(--text)]">
            {selected.size} selected
          </span>
          {BULK_TARGETS.map((s) => (
            <PrimaryButton
              key={s}
              type="button"
              onClick={() => bulkAction(s)}
              disabled={isPending}
            >
              → {s.replace(/_/g, " ")}
            </PrimaryButton>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] bg-white/5">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === optimisticVehicles.length && optimisticVehicles.length > 0}
                  onChange={toggleAll}
                  className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Plate</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Model</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {optimisticVehicles.map((v) => (
              <tr
                key={v.id}
                className={`border-b border-[var(--border)]/50 ${selected.has(v.id) ? "bg-[var(--accent)]/10" : "hover:bg-white/5"}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(v.id)}
                    onChange={() => toggle(v.id)}
                    className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-[var(--text)]">{v.plateNumber}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{v.model}</td>
                <td className="px-3 py-2">
                  <VehicleStatusChip status={v.status} />
                </td>
              </tr>
            ))}
            {optimisticVehicles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                  No vehicles yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VehicleStatusChip({ status }: { status: string }) {
  const color =
    status === "READY"
      ? "text-emerald-400 bg-emerald-500/15"
      : status === "CLEANING" || status === "NEEDS_CLEANING"
        ? "text-blue-400 bg-blue-500/15"
        : status === "QC_PENDING"
          ? "text-amber-400 bg-amber-500/15"
          : status === "IN_SERVICE"
            ? "text-cyan-400 bg-cyan-500/15"
            : "text-red-400 bg-red-500/15";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
