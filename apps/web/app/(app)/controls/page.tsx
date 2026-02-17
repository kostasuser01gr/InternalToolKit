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
    </div>
  );
}
