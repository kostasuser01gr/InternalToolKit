export type DemoEvent = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  source: "server-action" | "api";
  meta: Record<string, unknown>;
};

declare global {
  var demoEventsStore: DemoEvent[] | undefined;
}

const events = global.demoEventsStore ?? [];

if (process.env.NODE_ENV !== "production") {
  global.demoEventsStore = events;
}

export function appendDemoEvent(input: Omit<DemoEvent, "id" | "createdAt">) {
  const event: DemoEvent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };

  events.unshift(event);

  if (events.length > 800) {
    events.splice(800);
  }

  return event;
}

export function listDemoEvents(limit = 200) {
  return events.slice(0, Math.max(0, limit));
}
