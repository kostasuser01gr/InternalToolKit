"use client";

import * as Tabs from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  ariaLabel: string;
  options: SegmentedOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function SegmentedControl({
  value,
  ariaLabel,
  options,
  onValueChange,
  disabled = false,
  className,
}: SegmentedControlProps) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      <Tabs.List
        aria-label={ariaLabel}
        className="grid w-full auto-cols-fr grid-flow-col rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 p-1"
      >
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            disabled={disabled}
            className="focus-ring rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--text-muted)] data-[state=active]:bg-[#9a6fff2c] data-[state=active]:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

export { SegmentedControl };
