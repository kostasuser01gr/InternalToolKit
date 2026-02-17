import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

type KpiTrendProps = {
  changePercent: number;
  className?: string;
};

function KpiTrend({ changePercent, className }: KpiTrendProps) {
  const isPositive = changePercent > 0;
  const isNegative = changePercent < 0;
  const absolute = Math.abs(changePercent).toFixed(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
        isPositive && "border-emerald-300/45 bg-emerald-300/12 text-emerald-100",
        isNegative && "border-rose-300/45 bg-rose-300/12 text-rose-100",
        !isPositive &&
          !isNegative &&
          "border-[var(--border)] bg-white/8 text-[var(--text-muted)]",
        className,
      )}
      aria-label={`Trend ${changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat"} ${absolute} percent`}
    >
      {isPositive ? (
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      ) : isNegative ? (
        <ArrowDownRight className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowRight className="size-3.5" aria-hidden="true" />
      )}
      {isPositive ? "+" : isNegative ? "-" : ""}
      {absolute}%
    </span>
  );
}

export { KpiTrend };
