"use client";

import * as Switch from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

type ToggleSwitchProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

function ToggleSwitch({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: ToggleSwitchProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--text)]">
          {label}
        </label>
        {description ? (
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="focus-ring relative h-7 w-12 rounded-full border border-[var(--border)] bg-white/8 data-[state=checked]:bg-[#9a6fff2c] data-[state=checked]:shadow-[var(--glow-shadow)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-[#9a6fff]" />
      </Switch.Root>
    </div>
  );
}

export { ToggleSwitch };
