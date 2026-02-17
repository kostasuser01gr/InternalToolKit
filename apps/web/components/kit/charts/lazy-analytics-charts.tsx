"use client";

import dynamic from "next/dynamic";

const DynamicAnalyticsCharts = dynamic(
  () =>
    import("@/components/kit/charts/analytics-charts").then(
      (mod) => mod.AnalyticsCharts,
    ),
  {
    ssr: false,
    loading: () => <div className="skeleton h-72 rounded-[var(--radius-sm)]" />,
  },
);

function LazyAnalyticsCharts() {
  return <DynamicAnalyticsCharts />;
}

export { LazyAnalyticsCharts };
