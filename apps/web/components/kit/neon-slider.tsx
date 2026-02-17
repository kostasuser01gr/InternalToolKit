"use client";

import * as Slider from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type NeonSliderProps = {
  id: string;
  label: string;
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number[]) => void;
  disabled?: boolean;
  className?: string;
};

function NeonSlider({
  id,
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled = false,
  className,
}: NeonSliderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm text-[var(--text)]">
          {label}
        </label>
        <span className="text-xs text-[var(--text-muted)]">{value[0]}%</span>
      </div>
      <Slider.Root
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={onValueChange}
        disabled={disabled}
        className="focus-ring relative flex h-5 w-full touch-none items-center select-none disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Slider.Track className="relative h-2 grow overflow-hidden rounded-full bg-white/12">
          <Slider.Range className="absolute h-full bg-[image:var(--accent-purple-gradient)]" />
        </Slider.Track>
        <Slider.Thumb className="block size-5 rounded-full border border-white/40 bg-[#9a6fff] shadow-[var(--glow-shadow)]" />
      </Slider.Root>
    </div>
  );
}

export { NeonSlider };
