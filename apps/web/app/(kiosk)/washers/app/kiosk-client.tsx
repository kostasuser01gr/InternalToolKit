"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Vehicle = { id: string; plateNumber: string; model: string };

type KioskTask = {
  id: string | undefined;
  vehicleId: string;
  idempotencyKey: string;
  status: "pending" | "synced" | "failed";
  deduped: boolean | undefined;
  message: string | undefined;
  createdAt: string;
  vehicleLabel: string;
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

export function KioskClient({
  workspaceId,
  workspaceName,
  stationId,
  kioskToken,
  readOnly,
  vehicles,
}: KioskClientProps) {
  const [deviceId, setDeviceId] = useState("");
  const [online, setOnline] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<KioskTask[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // These are one-time browser-only initializations from external storage
    const id = getDeviceId();
    const queue = loadQueue();
    const isOnline = navigator.onLine;

    // Use a microtask to batch these state updates
    queueMicrotask(() => {
      setDeviceId(id);
      setTasks(queue);
      setOnline(isOnline);
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
              id: data.task?.id,
              status: "synced",
              deduped: data.deduped,
              message: data.message,
            };
          } else {
            updated[idx] = {
              vehicleId: existing.vehicleId,
              idempotencyKey: existing.idempotencyKey,
              createdAt: existing.createdAt,
              vehicleLabel: existing.vehicleLabel,
              id: existing.id,
              status: "failed",
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

  // Auto-sync on coming online
  useEffect(() => {
    if (online) {
      // Use microtask to avoid direct setState in effect body
      queueMicrotask(() => {
        syncPendingTasks();
      });
    }
  }, [online, syncPendingTasks]);

  // Periodic sync retry
  useEffect(() => {
    syncTimerRef.current = setInterval(() => {
      syncPendingTasks();
    }, 15_000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [syncPendingTasks]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || !selectedVehicle || submitting) return;

    setSubmitting(true);
    const idempotencyKey = generateUUID();
    const vehicle = vehicles.find((v) => v.id === selectedVehicle);
    const vehicleLabel = vehicle
      ? `${vehicle.plateNumber} · ${vehicle.model}`
      : selectedVehicle;

    const newTask: KioskTask = {
      id: undefined,
      vehicleId: selectedVehicle,
      idempotencyKey,
      status: "pending",
      deduped: undefined,
      message: undefined,
      createdAt: new Date().toISOString(),
      vehicleLabel,
    };

    if (!online) {
      // Queue for later sync
      const updated = [newTask, ...tasks];
      saveQueue(updated);
      setTasks(updated);
      setSelectedVehicle("");
      setNotes("");
      setSubmitting(false);
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
          vehicleId: selectedVehicle,
          idempotencyKey,
          deviceId,
          status: "TODO",
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        newTask.id = data.task?.id;
        newTask.status = "synced";
        newTask.deduped = data.deduped;
        newTask.message = data.message;
      } else {
        newTask.status = "failed";
        newTask.message = data.message || data.error;
      }
    } catch {
      // Offline fallback - queue for later
      newTask.status = "pending";
    }

    const updated = [newTask, ...tasks];
    saveQueue(updated);
    setTasks(updated);
    setSelectedVehicle("");
    setNotes("");
    setSubmitting(false);
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
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2 text-sm"
            >
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
                    ? "Deduped"
                    : "Synced"
                  : task.status === "failed"
                    ? "Failed"
                    : "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
