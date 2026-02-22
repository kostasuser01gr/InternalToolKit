"use client";

import { VirtualTable, type VirtualTableColumn } from "@/components/kit/virtual-table";
import { Badge } from "@/components/ui/badge";

type ActivityEvent = {
  id: string;
  time: string;
  action: string;
  entity: string;
  actor: string;
  source?: string;
};

type AuditEntry = {
  id: string;
  time: string;
  action: string;
  entity: string;
  actor: string;
};

const eventColumns: VirtualTableColumn<ActivityEvent>[] = [
  { key: "time", header: "Time", width: "140px", render: (r) => <span className="text-xs tabular-nums">{r.time}</span> },
  { key: "action", header: "Action", render: (r) => r.action },
  { key: "entity", header: "Entity", render: (r) => <span className="font-mono text-xs">{r.entity}</span> },
  { key: "actor", header: "Actor", width: "120px", render: (r) => r.actor },
  { key: "source", header: "Source", width: "80px", render: (r) => <Badge variant="default">{r.source ?? "—"}</Badge> },
];

const auditColumns: VirtualTableColumn<AuditEntry>[] = [
  { key: "time", header: "Time", width: "140px", render: (r) => <span className="text-xs tabular-nums">{r.time}</span> },
  { key: "action", header: "Action", render: (r) => r.action },
  { key: "entity", header: "Entity", render: (r) => <span className="font-mono text-xs">{r.entity}</span> },
  { key: "actor", header: "Actor", width: "160px", render: (r) => r.actor },
];

export function ActivityEventTable({ events }: { events: ActivityEvent[] }) {
  return (
    <VirtualTable
      data={events}
      columns={eventColumns}
      rowHeight={40}
      maxHeight={400}
      emptyMessage="No demo events yet. Trigger actions from command palette or feature pages."
    />
  );
}

export function AuditTrailTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <VirtualTable
      data={entries}
      columns={auditColumns}
      rowHeight={40}
      maxHeight={400}
      emptyMessage="No audit logs for current filters."
    />
  );
}
