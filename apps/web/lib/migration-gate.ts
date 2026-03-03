import { db } from "@/lib/db";

const MODULE_REQUIRED_TABLES: Record<string, string[]> = {
  imports: ["ImportBatch", "ImportChangeSet"],
  fleet: ["Vehicle", "VehicleBlocker", "VehicleQcLog"],
  work_orders: ["WorkOrder", "WorkOrderLine", "Vendor"],
  procurement: ["PurchaseOrder", "PurchaseOrderLine"],
  costs: ["CostCenter"],
  governance: ["EscalationPolicy", "StationFeatureFlag"],
};

type ModuleGate = {
  module: string;
  requiredTables: string[];
  missingTables: string[];
  ready: boolean;
};

export async function getMigrationGateStatus(): Promise<{
  ok: boolean;
  modules: ModuleGate[];
}> {
  const tableRows = await db.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;

  const existing = new Set(tableRows.map((row) => row.table_name));
  const modules = Object.entries(MODULE_REQUIRED_TABLES).map(([module, requiredTables]) => {
    const missingTables = requiredTables.filter((table) => !existing.has(table));

    return {
      module,
      requiredTables,
      missingTables,
      ready: missingTables.length === 0,
    };
  });

  return {
    ok: modules.every((module) => module.ready),
    modules,
  };
}
