import type { LucideIcon } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { KpiTrend } from "@/components/kit/kpi-trend";
import { Badge } from "@/components/ui/badge";

type StatCardProps = {
  label: string;
  value: string;
  delta: string;
  trendPercent?: number;
  icon?: LucideIcon;
};

function StatCard({ label, value, delta, trendPercent, icon: Icon }: StatCardProps) {
  return (
    <GlassCard interactive className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">{label}</p>
        {Icon ? (
          <Icon
            className="size-4 text-[var(--text-muted)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="kpi-font text-3xl leading-none font-semibold md:text-4xl">
        {value}
      </p>
      {typeof trendPercent === "number" ? (
        <KpiTrend changePercent={trendPercent} />
      ) : (
        <Badge variant="active">{delta}</Badge>
      )}
    </GlassCard>
  );
}

export { StatCard };
