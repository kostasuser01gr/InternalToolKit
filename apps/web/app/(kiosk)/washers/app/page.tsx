import { db } from "@/lib/db";

import { KioskClient } from "./kiosk-client";

export default async function WasherKioskPage() {
  const kioskToken = process.env.KIOSK_TOKEN ?? "";
  const kioskStationId = process.env.KIOSK_STATION_ID ?? "default";
  const hasValidToken = kioskToken.length > 0;

  // Determine workspace from the first workspace with vehicles (kiosk mode)
  const workspace = await db.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--text)]">No Workspace</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No workspace has been configured. Please set up a workspace first.
        </p>
      </div>
    );
  }

  const vehicles = await db.vehicle.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { plateNumber: "asc" },
  });

  return (
    <KioskClient
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      stationId={kioskStationId}
      kioskToken={hasValidToken ? kioskToken : ""}
      readOnly={!hasValidToken}
      vehicles={vehicles.map((v) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        model: v.model,
      }))}
    />
  );
}
