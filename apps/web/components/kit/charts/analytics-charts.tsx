"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const lineData = [
  { day: "Mon", incidents: 12, resolved: 8 },
  { day: "Tue", incidents: 9, resolved: 10 },
  { day: "Wed", incidents: 14, resolved: 12 },
  { day: "Thu", incidents: 11, resolved: 9 },
  { day: "Fri", incidents: 8, resolved: 11 },
  { day: "Sat", incidents: 7, resolved: 8 },
  { day: "Sun", incidents: 10, resolved: 9 },
];

const barData = [
  { team: "Ops", tasks: 82 },
  { team: "SRE", tasks: 64 },
  { team: "Data", tasks: 47 },
  { team: "Support", tasks: 71 },
];

function AnalyticsCharts() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="h-72 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#9da8c8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9da8c8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid rgba(150,167,208,0.35)",
                borderRadius: "10px",
                background: "rgba(10,12,22,0.95)",
                color: "#f5f7ff",
              }}
            />
            <Line
              type="monotone"
              dataKey="incidents"
              stroke="#9a6fff"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#4ee0a5"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-72 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="team"
              tick={{ fill: "#9da8c8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9da8c8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid rgba(150,167,208,0.35)",
                borderRadius: "10px",
                background: "rgba(10,12,22,0.95)",
                color: "#f5f7ff",
              }}
            />
            <Bar
              dataKey="tasks"
              fill="url(#barGradient)"
              radius={[8, 8, 0, 0]}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9a6fff" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#9a6fff" stopOpacity={0.32} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export { AnalyticsCharts };
