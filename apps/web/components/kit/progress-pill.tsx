import { cn } from "@/lib/utils";

type ProgressPillProps = {
  label: string;
  value: number;
  className?: string;
};

function ProgressPill({ label, value, className }: ProgressPillProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-[image:var(--accent-purple-gradient)] shadow-[var(--glow-shadow)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressPill };
