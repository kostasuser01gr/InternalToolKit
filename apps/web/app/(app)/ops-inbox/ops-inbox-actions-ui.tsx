"use client";

import { useRef, useState } from "react";
import {
  ackFeedItemAction,
  createIncidentAction,
  dismissNotificationAction,
  resolveIncidentAction,
} from "./actions";

export function AckFeedButton({ workspaceId, feedItemId }: { workspaceId: string; feedItemId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        await ackFeedItemAction(fd);
        setPending(false);
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="feedItemId" value={feedItemId} />
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-[var(--radius-sm)] bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {pending ? "…" : "✓ Ack"}
      </button>
    </form>
  );
}

export function DismissNotificationButton({ workspaceId, notificationId }: { workspaceId: string; notificationId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        await dismissNotificationAction(fd);
        setPending(false);
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="notificationId" value={notificationId} />
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-[var(--radius-sm)] bg-white/10 px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-white/15 disabled:opacity-50"
      >
        {pending ? "…" : "Dismiss"}
      </button>
    </form>
  );
}

export function ResolveIncidentButton({ workspaceId, incidentId }: { workspaceId: string; incidentId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        await resolveIncidentAction(fd);
        setPending(false);
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="incidentId" value={incidentId} />
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-[var(--radius-sm)] bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {pending ? "…" : "Resolve"}
      </button>
    </form>
  );
}

export function CreateIncidentForm({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="focus-ring rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
      >
        + Report Incident
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-4"
      action={async (fd) => {
        setPending(true);
        await createIncidentAction(fd);
        setPending(false);
        setOpen(false);
        formRef.current?.reset();
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input
        name="title"
        placeholder="Incident title"
        required
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
      />
      <select
        name="severity"
        defaultValue="MEDIUM"
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text)]"
      >
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="focus-ring rounded-[var(--radius-sm)] bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Incident"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
