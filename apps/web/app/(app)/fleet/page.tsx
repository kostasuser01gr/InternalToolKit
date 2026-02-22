import { VehicleEventType, VehicleStatus } from "@prisma/client";
import { format } from "date-fns";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { hasWorkspacePermission } from "@/lib/rbac";

import { addVehicleEventAction, createVehicleAction, updateVehicleAction } from "./actions";
import { FleetInlineField } from "./fleet-inline-field";
import { FleetVehicleList } from "./fleet-vehicle-list";

type FleetPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    vehicleId?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function FleetPage({ searchParams }: FleetPageProps) {
  const params = await searchParams;
  const { workspace, workspaceRole } = await getAppContext(params.workspaceId);

  const canRead = hasWorkspacePermission(workspaceRole, "fleet", "read");
  const canWrite = hasWorkspacePermission(workspaceRole, "fleet", "write");

  if (!canRead) {
    return (
      <GlassCard data-testid="fleet-blocked" className="space-y-3">
        <h1 className="kpi-font text-2xl font-semibold">Fleet access required</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your role does not include fleet management access.
        </p>
      </GlassCard>
    );
  }

  const vehicles = await db.vehicle.findMany({
    where: {
      workspaceId: workspace.id,
    },
    include: {
      events: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      _count: {
        select: {
          events: true,
        },
      },
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
    ],
  });

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === params.vehicleId) ?? vehicles[0] ?? null;

  return (
    <div className="space-y-6" data-testid="fleet-page">
      <PageHeader
        title="Fleet Management"
        subtitle="Track vehicle readiness, mileage, maintenance, fuel and damage logs in one place."
      />

      <StatusBanner error={params.error} success={params.success} />

      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Add Vehicle</h2>
          <form action={createVehicleAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="vehicle-plate">Plate number</Label>
                <Input
                  id="vehicle-plate"
                  name="plateNumber"
                  required
                  placeholder="KIN-1234"
                  disabled={!canWrite}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vehicle-model">Model</Label>
                <Input id="vehicle-model" name="model" required placeholder="Toyota Yaris" disabled={!canWrite} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="vehicle-status">Status</Label>
                <select
                  id="vehicle-status"
                  name="status"
                  className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                  defaultValue={VehicleStatus.READY}
                  disabled={!canWrite}
                >
                  {Object.values(VehicleStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vehicle-mileage">Mileage (km)</Label>
                <Input
                  id="vehicle-mileage"
                  name="mileageKm"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  disabled={!canWrite}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vehicle-fuel">Fuel (%)</Label>
                <Input
                  id="vehicle-fuel"
                  name="fuelPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={100}
                  disabled={!canWrite}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="vehicle-notes">Notes</Label>
              <Textarea id="vehicle-notes" name="notes" rows={3} disabled={!canWrite} />
            </div>

            <PrimaryButton type="submit" disabled={!canWrite}>
              Add vehicle
            </PrimaryButton>
          </form>

          <FleetVehicleList
            vehicles={vehicles.map((v) => ({
              id: v.id,
              plateNumber: v.plateNumber,
              model: v.model,
              status: v.status,
              mileageKm: v.mileageKm,
            }))}
            workspaceId={workspace.id}
            selectedId={selectedVehicle?.id}
          />
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <h2 className="kpi-font text-xl font-semibold">Vehicle State</h2>
            {selectedVehicle ? (
              <>
                {/* Quick inline edits */}
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Mileage (km)</span>
                    <div>
                      <FleetInlineField
                        workspaceId={workspace.id}
                        vehicleId={selectedVehicle.id}
                        field="mileageKm"
                        value={String(selectedVehicle.mileageKm)}
                        disabled={!canWrite}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Fuel (%)</span>
                    <div>
                      <FleetInlineField
                        workspaceId={workspace.id}
                        vehicleId={selectedVehicle.id}
                        field="fuelPercent"
                        value={String(selectedVehicle.fuelPercent)}
                        disabled={!canWrite}
                        placeholder="100"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Notes</span>
                    <div>
                      <FleetInlineField
                        workspaceId={workspace.id}
                        vehicleId={selectedVehicle.id}
                        field="notes"
                        value={selectedVehicle.notes ?? ""}
                        disabled={!canWrite}
                        placeholder="Click to add notes"
                      />
                    </div>
                  </div>
                </div>

                {/* Full update form */}
                <details className="group">
                  <summary className="cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                    Full update form ▸
                  </summary>
                  <form action={updateVehicleAction} className="mt-3 space-y-3">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="vehicleId" value={selectedVehicle.id} />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="vehicle-update-status">Status</Label>
                        <select
                          id="vehicle-update-status"
                          name="status"
                          defaultValue={selectedVehicle.status}
                          className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                          disabled={!canWrite}
                        >
                          {Object.values(VehicleStatus).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="vehicle-update-mileage">Mileage (km)</Label>
                        <Input
                          id="vehicle-update-mileage"
                          name="mileageKm"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={selectedVehicle.mileageKm}
                          disabled={!canWrite}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="vehicle-update-fuel">Fuel (%)</Label>
                        <Input
                          id="vehicle-update-fuel"
                          name="fuelPercent"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          defaultValue={selectedVehicle.fuelPercent}
                          disabled={!canWrite}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="vehicle-update-notes">Notes</Label>
                      <Textarea
                        id="vehicle-update-notes"
                        name="notes"
                        rows={3}
                        defaultValue={selectedVehicle.notes ?? ""}
                        disabled={!canWrite}
                      />
                    </div>

                    <PrimaryButton type="submit" disabled={!canWrite}>
                      Save vehicle update
                    </PrimaryButton>
                  </form>
                </details>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Select a vehicle to update.</p>
            )}
          </GlassCard>

          <GlassCard className="space-y-4">
            <h2 className="kpi-font text-xl font-semibold">Fuel / Damage / Maintenance Events</h2>
            {selectedVehicle ? (
              <>
                <form action={addVehicleEventAction} className="space-y-3">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="vehicleId" value={selectedVehicle.id} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-event-type">Type</Label>
                      <select
                        id="vehicle-event-type"
                        name="type"
                        defaultValue={VehicleEventType.STATUS_CHANGE}
                        className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-3 text-sm text-[var(--text)]"
                        disabled={!canWrite}
                      >
                        {Object.values(VehicleEventType).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-event-text">Value text</Label>
                      <Input id="vehicle-event-text" name="valueText" disabled={!canWrite} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-event-number">Value number</Label>
                      <Input
                        id="vehicle-event-number"
                        name="valueNumber"
                        type="number"
                        step="0.1"
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="vehicle-event-notes">Notes</Label>
                    <Textarea id="vehicle-event-notes" name="notes" rows={3} disabled={!canWrite} />
                  </div>

                  <PrimaryButton type="submit" disabled={!canWrite}>
                    Add event
                  </PrimaryButton>
                </form>

                <div className="space-y-2">
                  {selectedVehicle.events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
                    >
                      <p className="font-medium text-[var(--text)]">{event.type}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {format(event.createdAt, "dd MMM yyyy HH:mm")}
                      </p>
                      {event.valueText ? (
                        <p className="text-sm text-[var(--text-muted)]">{event.valueText}</p>
                      ) : null}
                      {event.valueNumber != null ? (
                        <p className="text-sm text-[var(--text-muted)]">{event.valueNumber}</p>
                      ) : null}
                      {event.notes ? (
                        <p className="text-sm text-[var(--text-muted)]">{event.notes}</p>
                      ) : null}
                    </article>
                  ))}
                  {selectedVehicle.events.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No events recorded.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Select a vehicle to log events.</p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
