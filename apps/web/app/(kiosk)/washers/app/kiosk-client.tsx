"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Vehicle = { id: string; plateNumber: string; model: string };

type Preset = {
  label: string;
  exterior: boolean;
  interior: boolean;
  vacuum: boolean;
  priorityNotes: string | undefined;
};

const PRESETS: Preset[] = [
  { label: "Basic", exterior: true, interior: false, vacuum: false, priorityNotes: undefined },
  { label: "Full", exterior: true, interior: true, vacuum: true, priorityNotes: undefined },
  { label: "Express", exterior: true, interior: false, vacuum: true, priorityNotes: undefined },
  { label: "VIP", exterior: true, interior: true, vacuum: true, priorityNotes: "VIP — priority wash" },
];

type KioskTask = {
  id: string | undefined;
  vehicleId: string;
  idempotencyKey: string;
  status: "pending" | "synced" | "failed";
  taskStatus: string | undefined;
  deduped: boolean | undefined;
  message: string | undefined;
  createdAt: string;
  vehicleLabel: string;
  exterior: boolean;
  interior: boolean;
  vacuum: boolean;
};

type KioskClientProps = {
  workspaceId: string;
  workspaceName: string;
  stationId: string;
  kioskToken: string;
  readOnly: boolean;
  vehicles: Vehicle[];
};

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getDeviceId(): string {
  const KEY = "KIOSK_DEVICE_ID";
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

const QUEUE_KEY = "KIOSK_OFFLINE_QUEUE";

function loadQueue(): KioskTask[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: KioskTask[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export function KioskClient({
  workspaceId,
  workspaceName,
  stationId,
  kioskToken,
  readOnly,
  vehicles,
}: KioskClientProps) {
  const [deviceId] = useState(() => (typeof window !== "undefined" ? getDeviceId() : ""));
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<KioskTask[]>(() => loadQueue());
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick Plate input
  const [plateInput, setPlateInput] = useState("");
  const plateInputRef = useRef<HTMLInputElement>(null);

  // Preset / service checkboxes
  const [exterior, setExterior] = useState(true);
  const [interior, setInterior] = useState(false);
  const [vacuum, setVacuum] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function findVehicleByPlate(query: string): Vehicle | undefined {
    const q = query.toUpperCase();
    return vehicles.find((v) => v.plateNumber.toUpperCase() === q)
      ?? vehicles.find((v) => v.plateNumber.toUpperCase().includes(q));
  }

  function applyPreset(preset: Preset) {
    setExterior(preset.exterior);
    setInterior(preset.interior);
    setVacuum(preset.vacuum);
    setActivePreset(preset.label);
    setNotes(preset.priorityNotes ?? "");
  }

  // Clear preset highlight when checkboxes change manually
  function handleCheckboxChange(
    setter: (v: boolean) => void,
    value: boolean,
  ) {
    setter(value);
    setActivePreset(null);
  }

  // Update sync status indicator
  useEffect(() => {
    const el = document.getElementById("kiosk-sync-status");
    if (el) {
      const pending = tasks.filter((t) => t.status === "pending").length;
      if (!online) {
        el.textContent = "● Offline";
        el.style.color = "#f87171";
      } else if (pending > 0) {
        el.textContent = `● Syncing (${pending})`;
        el.style.color = "#fbbf24";
      } else {
        el.textContent = "● Online";
        el.style.color = "#34d399";
      }
    }
  }, [online, tasks]);

  const syncPendingTasks = useCallback(async () => {
    if (!online || readOnly) return;
    const current = loadQueue();
    const pending = current.filter((t) => t.status === "pending");
    if (pending.length === 0) return;

    const updated = [...current];
    for (const task of pending) {
      try {
        const res = await fetch("/api/kiosk/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kiosk-token": kioskToken,
          },
          body: JSON.stringify({
            workspaceId,
            vehicleId: task.vehicleId,
            idempotencyKey: task.idempotencyKey,
            deviceId,
            status: "TODO",
            notes: "",
            exteriorDone: task.exterior,
            interiorDone: task.interior,
            vacuumDone: task.vacuum,
          }),
        });
        const data = await res.json();
        const idx = updated.findIndex(
          (t) => t.idempotencyKey === task.idempotencyKey,
        );
        if (idx !== -1) {
          const existing = updated[idx]!;
          if (res.ok) {
            updated[idx] = {
              vehicleId: existing.vehicleId,
              idempotencyKey: existing.idempotencyKey,
              createdAt: existing.createdAt,
              vehicleLabel: existing.vehicleLabel,
              exterior: existing.exterior,
              interior: existing.interior,
              vacuum: existing.vacuum,
              id: data.task?.id,
              status: "synced",
              taskStatus: data.task?.status ?? "TODO",
              deduped: data.deduped,
              message: data.message,
            };
          } else {
            updated[idx] = {
              vehicleId: existing.vehicleId,
              idempotencyKey: existing.idempotencyKey,
              createdAt: existing.createdAt,
              vehicleLabel: existing.vehicleLabel,
              exterior: existing.exterior,
              interior: existing.interior,
              vacuum: existing.vacuum,
              id: existing.id,
              status: "failed",
              taskStatus: undefined,
              deduped: undefined,
              message: data.message || data.error,
            };
          }
        }
      } catch {
        // Will retry next cycle
      }
    }
    saveQueue(updated);
    setTasks(updated);
  }, [online, readOnly, kioskToken, workspaceId, deviceId]);

  // Auto-sync: use interval that also handles online state changes
  useEffect(() => {
    const doSync = () => {
      if (!online || readOnly) return;
      void syncPendingTasks();
    };
    // Initial sync attempt on mount/online change via interval
    syncTimerRef.current = setInterval(doSync, 15_000);
    // Also fire once after a short delay
    const immediate = setTimeout(doSync, 500);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      clearTimeout(immediate);
    };
  }, [syncPendingTasks, online, readOnly]);

  // Core submit logic shared by dropdown form and quick-plate
  async function submitTask(vehicleId: string, taskNotes: string) {
    const idempotencyKey = generateUUID();
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const vehicleLabel = vehicle
      ? `${vehicle.plateNumber} · ${vehicle.model}`
      : vehicleId;

    const newTask: KioskTask = {
      id: undefined,
      vehicleId,
      idempotencyKey,
      status: "pending",
      taskStatus: undefined,
      deduped: undefined,
      message: undefined,
      createdAt: new Date().toISOString(),
      vehicleLabel,
      exterior,
      interior,
      vacuum,
    };

    if (!online) {
      const updated = [newTask, ...tasks];
      saveQueue(updated);
      setTasks(updated);
      return;
    }

    try {
      const res = await fetch("/api/kiosk/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-token": kioskToken,
        },
        body: JSON.stringify({
          workspaceId,
          vehicleId,
          idempotencyKey,
          deviceId,
          status: "TODO",
          notes: taskNotes || undefined,
          exteriorDone: exterior,
          interiorDone: interior,
          vacuumDone: vacuum,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        newTask.id = data.task?.id;
        newTask.status = "synced";
        newTask.taskStatus = data.task?.status ?? "TODO";
        newTask.deduped = data.deduped;
        newTask.message = data.message;
      } else {
        newTask.status = "failed";
        newTask.message = data.message || data.error;
      }
    } catch {
      newTask.status = "pending";
    }

    const updated = [newTask, ...tasks];
    saveQueue(updated);
    setTasks(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || !selectedVehicle || submitting) return;

    setSubmitting(true);
    await submitTask(selectedVehicle, notes);
    setSelectedVehicle("");
    setNotes("");
    setSubmitting(false);
  }

  // Quick Plate: Enter handler (Next-car mode)
  async function handleQuickPlate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const query = plateInput.trim().toUpperCase();
    if (!query || readOnly || submitting) return;

    const match = findVehicleByPlate(query);

    if (!match) return; // no match — do nothing

    setSubmitting(true);
    await submitTask(match.id, notes);
    setPlateInput("");
    setNotes("");
    setSubmitting(false);
    // Next-car mode: refocus plate input
    plateInputRef.current?.focus();
  }

  // Action buttons: update task status on server
  async function handleTaskAction(task: KioskTask, newStatus: string) {
    if (!task.id || readOnly) return;
    try {
      const res = await fetch(`/api/kiosk/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-token": kioskToken,
        },
        body: JSON.stringify({
          workspaceId,
          status: newStatus,
          deviceId,
        }),
      });
      if (res.ok) {
        const updated = tasks.map((t) =>
          t.idempotencyKey === task.idempotencyKey
            ? { ...t, taskStatus: newStatus }
            : t,
        );
        saveQueue(updated);
        setTasks(updated);
      }
    } catch {
      // ignore — user can retry
    }
  }

  return (
    <div
      className="mx-auto max-w-lg space-y-6"
      data-testid="kiosk-page"
    >
      {readOnly && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <strong>Read-only mode:</strong> Kiosk token is missing or invalid.
          Task creation is disabled. Contact an administrator.
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 backdrop-blur">
        <h2 className="mb-1 text-sm font-medium text-[var(--text-muted)]">
          {workspaceName} — Station: {stationId}
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Device: {deviceId ? deviceId.slice(0, 8) + "…" : "loading"}
        </p>
      </div>

      {/* Quick Plate Input (Next-car mode) */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 backdrop-blur">
        <h2 className="mb-2 text-xl font-semibold text-[var(--text)]">
          Quick Plate
        </h2>
        <p className="mb-2 text-xs text-[var(--text-muted)]">
          Type a plate number and press Enter to instantly create a task.
        </p>
        <input
          ref={plateInputRef}
          type="text"
          value={plateInput}
          onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
          onKeyDown={handleQuickPlate}
          placeholder="e.g. ABC1234"
          autoFocus
          disabled={readOnly}
          className="focus-ring h-14 w-full rounded-lg border border-[var(--border)] bg-white/6 px-4 text-xl font-mono tracking-widest text-[var(--text)] placeholder:text-[var(--text-muted)]/40"
          data-testid="quick-plate-input"
        />
        {plateInput.trim() && (() => {
          const match = findVehicleByPlate(plateInput.trim());
          return match ? (
            <p className="mt-1 text-xs text-emerald-300">
              ↵ Enter → {match.plateNumber} · {match.model}
            </p>
          ) : (
            <p className="mt-1 text-xs text-rose-300">No matching vehicle</p>
          );
        })()}
      </div>

      {/* Preset Buttons */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 backdrop-blur">
        <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
          Service Presets
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={readOnly}
              className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${
                activePreset === preset.label
                  ? "border-purple-400 bg-purple-500/30 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,.35)]"
                  : "border-[var(--border)] bg-white/6 text-[var(--text)] hover:bg-white/10"
              } disabled:opacity-50`}
              data-testid={`preset-${preset.label.toLowerCase()}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {/* Service checkboxes */}
        <div className="mt-3 flex gap-4 text-sm text-[var(--text)]">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={exterior}
              onChange={(e) => handleCheckboxChange(setExterior, e.target.checked)}
              disabled={readOnly}
              className="accent-purple-500"
            />
            Exterior
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={interior}
              onChange={(e) => handleCheckboxChange(setInterior, e.target.checked)}
              disabled={readOnly}
              className="accent-purple-500"
            />
            Interior
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={vacuum}
              onChange={(e) => handleCheckboxChange(setVacuum, e.target.checked)}
              disabled={readOnly}
              className="accent-purple-500"
            />
            Vacuum
          </label>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 backdrop-blur"
      >
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Register Wash Task
        </h2>

        <div className="space-y-1">
          <label
            htmlFor="kiosk-vehicle"
            className="text-sm font-medium text-[var(--text)]"
          >
            Vehicle
          </label>
          <select
            id="kiosk-vehicle"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="focus-ring h-12 w-full rounded-lg border border-[var(--border)] bg-white/6 px-3 text-base text-[var(--text)]"
            required
            disabled={readOnly}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} · {v.model}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="kiosk-notes"
            className="text-sm font-medium text-[var(--text)]"
          >
            Notes (optional)
          </label>
          <textarea
            id="kiosk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="focus-ring min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-white/6 px-3 py-2 text-base text-[var(--text)]"
            placeholder="Optional cleaning notes…"
            maxLength={1000}
            disabled={readOnly}
          />
        </div>

        <button
          type="submit"
          disabled={readOnly || submitting || !selectedVehicle}
          className="h-12 w-full rounded-lg bg-[var(--accent-purple-gradient,#7c3aed)] font-semibold text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Saving…" : online ? "Create Task" : "Queue Offline"}
        </button>
      </form>

      {tasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-muted)]">
            Recent submissions
          </h3>
          {tasks.slice(0, 20).map((task) => (
            <div
              key={task.idempotencyKey}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {task.vehicleLabel}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {task.message || (task.status === "pending" ? "Pending sync" : "")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    task.status === "synced"
                      ? "bg-emerald-400/20 text-emerald-300"
                      : task.status === "failed"
                        ? "bg-rose-400/20 text-rose-300"
                        : "bg-amber-400/20 text-amber-300"
                  }`}
                >
                  {task.status === "synced"
                    ? task.deduped
                      ? "Updated (deduped)"
                      : "Created"
                    : task.status === "failed"
                      ? "Failed"
                      : "Pending"}
                </span>
              </div>

              {/* One-hand action buttons for synced tasks */}
              {task.status === "synced" && task.id && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTaskAction(task, "IN_PROGRESS")}
                    disabled={readOnly || task.taskStatus === "IN_PROGRESS"}
                    className="h-10 rounded-lg border border-blue-400/40 bg-blue-500/20 text-sm font-semibold text-blue-200 transition-all hover:bg-blue-500/30 disabled:opacity-40"
                    data-testid={`action-start-${task.idempotencyKey}`}
                  >
                    ▶ Start
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTaskAction(task, "DONE")}
                    disabled={readOnly || task.taskStatus === "DONE"}
                    className="h-10 rounded-lg border border-emerald-400/40 bg-emerald-500/20 text-sm font-semibold text-emerald-200 transition-all hover:bg-emerald-500/30 disabled:opacity-40"
                    data-testid={`action-done-${task.idempotencyKey}`}
                  >
                    ✓ Done
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTaskAction(task, "BLOCKED")}
                    disabled={readOnly || task.taskStatus === "BLOCKED"}
                    className="h-10 rounded-lg border border-rose-400/40 bg-rose-500/20 text-sm font-semibold text-rose-200 transition-all hover:bg-rose-500/30 disabled:opacity-40"
                    data-testid={`action-issue-${task.idempotencyKey}`}
                  >
                    ⚠ Issue
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
