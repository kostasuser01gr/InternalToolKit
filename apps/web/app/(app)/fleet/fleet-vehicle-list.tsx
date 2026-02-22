"use client";

import { useRouter } from "next/navigation";

import { VirtualTable, type VirtualTableColumn } from "@/components/kit/virtual-table";

type VehicleRow = {
  id: string;
  plateNumber: string;
  model: string;
  status: string;
  mileageKm: number;
};

type FleetVehicleListProps = {
  vehicles: VehicleRow[];
  workspaceId: string;
  selectedId?: string | undefined;
};

const columns: VirtualTableColumn<VehicleRow>[] = [
  {
    key: "plate",
    header: "Plate",
    width: "120px",
    render: (row) => <span className="font-medium">{row.plateNumber}</span>,
  },
  {
    key: "model",
    header: "Model",
    render: (row) => <span className="text-[var(--text-muted)]">{row.model}</span>,
  },
  {
    key: "status",
    header: "Status",
    width: "100px",
    render: (row) => {
      const color =
        row.status === "READY"
          ? "text-emerald-400"
          : row.status === "IN_USE"
            ? "text-blue-400"
            : "text-amber-400";
      return <span className={color}>{row.status}</span>;
    },
  },
  {
    key: "mileage",
    header: "KM",
    width: "80px",
    render: (row) => (
      <span className="text-[var(--text-muted)] tabular-nums">
        {row.mileageKm.toLocaleString()}
      </span>
    ),
  },
];

export function FleetVehicleList({
  vehicles,
  workspaceId,
  selectedId,
}: FleetVehicleListProps) {
  const router = useRouter();

  return (
    <VirtualTable
      data={vehicles}
      columns={columns}
      maxHeight={400}
      rowHeight={40}
      emptyMessage="No vehicles yet."
      onRowClick={(row) => {
        router.push(`/fleet?workspaceId=${workspaceId}&vehicleId=${row.id}`);
      }}
      className={selectedId ? "vehicle-list-with-selection" : ""}
    />
  );
}
