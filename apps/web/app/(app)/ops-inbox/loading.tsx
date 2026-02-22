import { GlassCard } from "@/components/kit/glass-card";

export default function OpsInboxLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
      </div>
      {[1, 2, 3].map((i) => (
        <GlassCard key={i} className="space-y-3">
          <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded bg-white/5" />
            <div className="h-12 animate-pulse rounded bg-white/5" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
