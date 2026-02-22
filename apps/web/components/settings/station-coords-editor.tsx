"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateStationCoordsAction } from "@/app/(app)/settings/station-actions";

type StationData = {
  id: string;
  name: string;
  code: string;
  lat: number | null;
  lon: number | null;
};

type StationCoordsEditorProps = {
  stations: StationData[];
  workspaceId: string;
};

export function StationCoordsEditor({
  stations,
  workspaceId,
}: StationCoordsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="kpi-font text-xl font-semibold">Station Coordinates</h2>
        <Badge variant="default">{stations.length} stations</Badge>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Set latitude/longitude for each station. Used by the weather feed for per-station forecasts.
      </p>

      {message ? (
        <p className="text-sm text-emerald-400">{message}</p>
      ) : null}

      <div className="space-y-3">
        {stations.map((station) => (
          <form
            key={station.id}
            className="flex items-end gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
            action={(formData) => {
              startTransition(async () => {
                const result = await updateStationCoordsAction({
                  workspaceId,
                  stationId: station.id,
                  lat: parseFloat(formData.get("lat") as string),
                  lon: parseFloat(formData.get("lon") as string),
                });
                if (result.ok) {
                  setMessage(`${station.name} coordinates saved.`);
                  router.refresh();
                } else {
                  setMessage(`Error: ${result.error}`);
                }
              });
            }}
          >
            <div className="min-w-[100px]">
              <p className="text-sm font-medium text-[var(--text)]">{station.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{station.code}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`lat-${station.id}`}>Lat</Label>
              <Input
                id={`lat-${station.id}`}
                name="lat"
                type="number"
                step="0.0001"
                defaultValue={station.lat ?? ""}
                placeholder="37.9838"
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`lon-${station.id}`}>Lon</Label>
              <Input
                id={`lon-${station.id}`}
                name="lon"
                type="number"
                step="0.0001"
                defaultValue={station.lon ?? ""}
                placeholder="23.7275"
                className="w-28"
              />
            </div>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? "…" : "Save"}
            </PrimaryButton>
          </form>
        ))}
        {stations.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No stations configured. Create stations in the workspace admin.
          </p>
        ) : null}
      </div>
    </GlassCard>
  );
}
