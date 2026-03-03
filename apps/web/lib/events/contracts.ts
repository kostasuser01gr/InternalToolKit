export const EVENT_CONTRACTS = [
  "workorder.updated",
  "incident.escalated",
  "procurement.received",
  "sla.breached",
] as const;

export type EventContract = (typeof EVENT_CONTRACTS)[number];
