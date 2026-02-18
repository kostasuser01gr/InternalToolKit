"use client";

import { SegmentedControl } from "@/components/kit/segmented-control";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { useToast } from "@/components/layout/toast-provider";
import { useUiPreferences } from "@/components/layout/ui-preferences-provider";
import { logClientActivity } from "@/lib/activity/client";

function UiPreferencesPanel() {
  const {
    density,
    setDensity,
    quantumTheme,
    setQuantumTheme,
    reduceMotion,
    setReduceMotion,
  } = useUiPreferences();
  const { toast } = useToast();

  return (
    <div className="space-y-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text)]">Density</p>
        <SegmentedControl
          value={density}
          ariaLabel="Density preference"
          options={[
            { label: "Comfortable", value: "comfortable" },
            { label: "Compact", value: "compact" },
          ]}
          onValueChange={async (value) => {
            const nextDensity = value === "compact" ? "compact" : "comfortable";
            setDensity(nextDensity);
            toast({
              title: `Density set to ${nextDensity}.`,
              tone: "info",
            });
            await logClientActivity({
              action: "ui.density_changed",
              entityType: "ui_preference",
              entityId: "density",
              meta: {
                density: nextDensity,
              },
            });
          }}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text)]">Quantum theme</p>
        <SegmentedControl
          value={quantumTheme}
          ariaLabel="Quantum theme preference"
          options={[
            { label: "Violet", value: "violet" },
            { label: "Cyan", value: "cyan" },
            { label: "Amber", value: "amber" },
          ]}
          onValueChange={async (value) => {
            const nextTheme =
              value === "cyan" || value === "amber" ? value : "violet";
            setQuantumTheme(nextTheme);
            toast({
              title: `Quantum theme set to ${nextTheme}.`,
              tone: "info",
            });
            await logClientActivity({
              action: "ui.quantum_theme_changed",
              entityType: "ui_preference",
              entityId: "quantum_theme",
              meta: {
                quantumTheme: nextTheme,
              },
            });
          }}
        />
      </div>

      <ToggleSwitch
        id="motion-toggle"
        label="Reduced motion"
        description="Disable non-essential motion for accessibility and focus."
        checked={reduceMotion}
        onCheckedChange={async (checked) => {
          setReduceMotion(checked);
          toast({
            title: checked ? "Reduced motion enabled." : "Reduced motion disabled.",
            tone: "info",
          });
          await logClientActivity({
            action: "ui.motion_changed",
            entityType: "ui_preference",
            entityId: "motion",
            meta: {
              reduceMotion: checked,
            },
          });
        }}
      />
    </div>
  );
}

export { UiPreferencesPanel };
