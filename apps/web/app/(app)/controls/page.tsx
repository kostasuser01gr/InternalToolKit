"use client";

import { useState } from "react";

import { GlassCard } from "@/components/kit/glass-card";
import { NeonSlider } from "@/components/kit/neon-slider";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { PageHeader } from "@/components/layout/page-header";

export default function ControlsPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lightsEnabled, setLightsEnabled] = useState(false);
  const [soundLevel, setSoundLevel] = useState([72]);
  const [brightnessLevel, setBrightnessLevel] = useState([38]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [cronFailures, setCronFailures] = useState<null | {
    failedRuns: Array<{ id: string }>;
    deadLetter: { open: number };
  }>(null);
  const [deadLetter, setDeadLetter] = useState<null | {
    summary: { open: number; resolved: number; ignored: number };
  }>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadCronFailures() {
    if (!workspaceId.trim()) {
      setStatusMessage("Enter workspace ID to load reliability data.");
      return;
    }

    setStatusMessage("Loading cron failures...");
    const response = await fetch(`/api/cron/failures?workspaceId=${encodeURIComponent(workspaceId.trim())}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setStatusMessage(payload?.error?.message ?? "Failed to load cron failures.");
      return;
    }

    setCronFailures(payload.data);
    setStatusMessage("Cron failure dashboard updated.");
  }

  async function loadDeadLetter() {
    if (!workspaceId.trim()) {
      setStatusMessage("Enter workspace ID to load dead-letter entries.");
      return;
    }

    setStatusMessage("Loading dead-letter entries...");
    const response = await fetch(`/api/cron/dead-letter?workspaceId=${encodeURIComponent(workspaceId.trim())}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setStatusMessage(payload?.error?.message ?? "Failed to load dead-letter entries.");
      return;
    }

    setDeadLetter(payload.data);
    setStatusMessage("Dead-letter triage view updated.");
  }

  return (
    <div className="page-stack" data-testid="controls-page">
      <PageHeader
        title="Controls"
        subtitle="Programmable control surfaces with neon active states for device and workflow tuning."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Sound Controls</h2>
          <ToggleSwitch
            id="sound-enabled"
            label="Sound Enabled"
            description="Enable alerts and ambient operational cues."
            checked={soundEnabled}
            onCheckedChange={setSoundEnabled}
          />
          <NeonSlider
            id="sound-level"
            label="Output Level"
            value={soundLevel}
            onValueChange={setSoundLevel}
          />
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Lighting Controls</h2>
          <ToggleSwitch
            id="lights-enabled"
            label="Lights Enabled"
            description="Activate scene lighting automation."
            checked={lightsEnabled}
            onCheckedChange={setLightsEnabled}
          />
          <NeonSlider
            id="brightness-level"
            label="Brightness"
            value={brightnessLevel}
            onValueChange={setBrightnessLevel}
          />
        </GlassCard>
      </section>

      <section className="grid gap-4">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Reliability Guardrails</h2>
          <p className="text-sm text-muted-foreground">
            Cron failure dashboard + dead-letter triage (retry/ignore/assign via API).
          </p>
          <label className="grid gap-1 text-sm">
            <span>Workspace ID</span>
            <input
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none ring-0"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.currentTarget.value)}
              placeholder="workspace_cuid"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadCronFailures}
              className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            >
              Load Cron Failures
            </button>
            <button
              type="button"
              onClick={loadDeadLetter}
              className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            >
              Load Dead Letters
            </button>
          </div>
          {statusMessage ? <p className="text-xs text-muted-foreground">{statusMessage}</p> : null}
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <p className="font-medium text-foreground">Cron failures (last window)</p>
              <p>Failed runs: {cronFailures?.failedRuns.length ?? "-"}</p>
              <p>Open dead letters (cron view): {cronFailures?.deadLetter.open ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Dead-letter triage</p>
              <p>Open: {deadLetter?.summary.open ?? "-"}</p>
              <p>Resolved: {deadLetter?.summary.resolved ?? "-"}</p>
              <p>Ignored: {deadLetter?.summary.ignored ?? "-"}</p>
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
