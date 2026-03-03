export type ModuleBackend = "prisma" | "convex_realtime";

export type BackendDecisionEntry = {
  module: string;
  readPath: ModuleBackend;
  writePath: ModuleBackend;
  notes?: string;
};

export const MODULE_BACKEND_DECISIONS: Record<string, BackendDecisionEntry> = {
  activity: {
    module: "activity",
    readPath: "prisma",
    writePath: "prisma",
  },
  analytics: {
    module: "analytics",
    readPath: "prisma",
    writePath: "prisma",
  },
  chat: {
    module: "chat",
    readPath: "prisma",
    writePath: "prisma",
    notes: "Convex remains realtime transport only until explicit promotion.",
  },
  fleet: {
    module: "fleet",
    readPath: "prisma",
    writePath: "prisma",
  },
  shifts: {
    module: "shifts",
    readPath: "prisma",
    writePath: "prisma",
  },
  washers: {
    module: "washers",
    readPath: "prisma",
    writePath: "prisma",
  },
  imports: {
    module: "imports",
    readPath: "prisma",
    writePath: "prisma",
  },
  feeds: {
    module: "feeds",
    readPath: "prisma",
    writePath: "prisma",
  },
  work_orders: {
    module: "work_orders",
    readPath: "prisma",
    writePath: "prisma",
  },
  procurement: {
    module: "procurement",
    readPath: "prisma",
    writePath: "prisma",
  },
  costs: {
    module: "costs",
    readPath: "prisma",
    writePath: "prisma",
  },
};

export function getBackendDecision(moduleName: string) {
  return MODULE_BACKEND_DECISIONS[moduleName] ?? null;
}

export function assertBackendDecisionLocked(moduleName: string) {
  const decision = getBackendDecision(moduleName);
  if (!decision) {
    throw new Error(`Backend decision missing for module "${moduleName}".`);
  }
  return decision;
}
