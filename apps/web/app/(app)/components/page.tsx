"use client";

import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { DataTable } from "@/components/kit/data-table";
import { FilterBar } from "@/components/kit/filter-bar";
import { GlassCard } from "@/components/kit/glass-card";
import { KpiTrend } from "@/components/kit/kpi-trend";
import { NeonSlider } from "@/components/kit/neon-slider";
import { PrimaryButton } from "@/components/kit/primary-button";
import { ProgressPill } from "@/components/kit/progress-pill";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { StatCard } from "@/components/kit/stat-card";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Badge } from "@/components/ui/badge";
import { features } from "@/lib/constants/features";
import { cn } from "@/lib/utils";

const sampleRows = [
  { id: "row-1", metric: "New Tickets", value: "42", owner: "Ops Team" },
  { id: "row-2", metric: "Resolved Tickets", value: "37", owner: "Support" },
  { id: "row-3", metric: "SLA Risk", value: "8", owner: "On-call" },
];

const shellStateContract = [
  {
    component: "BottomNav",
    default: "Visible on mobile with five items.",
    hover: "Hover/tap feedback via glass highlight.",
    active: "Current route uses neon accent + glow.",
    disabled: "Primary action can be disabled by feature gate.",
    loading: "Route transitions keep shell stable.",
    error: "Offline banner + toasts communicate failures.",
  },
  {
    component: "SideRail",
    default: "Visible on tablet breakpoints.",
    hover: "Icon buttons brighten on hover.",
    active: "Current route has accent border and glow.",
    disabled: "Items hidden via feature flags.",
    loading: "Shell persists while page streams.",
    error: "Error boundary preserves rail and nav.",
  },
  {
    component: "Sidebar",
    default: "Visible on desktop with labels.",
    hover: "Row background and border preview state.",
    active: "aria-current route is neon-accented.",
    disabled: "Links can be removed by role/feature.",
    loading: "Layout remains fixed during data loading.",
    error: "Global error fallback keeps navigation context.",
  },
  {
    component: "TopBar",
    default: "Desktop search/actions/profile row.",
    hover: "Buttons and menus expose hover feedback.",
    active: "Focused controls keep ring + active states.",
    disabled: "Create/search can be disabled per feature.",
    loading: "Header remains visible during page suspense.",
    error: "Status/toast messaging appears without layout shift.",
  },
  {
    component: "PageHeader",
    default: "Title + subtitle + breadcrumbs on desktop.",
    hover: "Actions use focus/hover ring via button styles.",
    active: "Context is reflected in breadcrumb current item.",
    disabled: "Header actions can disable while mutating.",
    loading: "Skeleton replaces body, not header shell.",
    error: "StatusBanner renders inline error summary.",
  },
  {
    component: "SearchBar",
    default: "Search input with icon and label.",
    hover: "Input border tint on hover and focus.",
    active: "Focused with visible focus ring.",
    disabled: "Disabled state reduces opacity and blocks input.",
    loading: "Spinner icon when async search is pending.",
    error: "Error state highlights border + message.",
  },
] as const;

type ShowcaseState =
  | "Default"
  | "Hover"
  | "Active"
  | "Disabled"
  | "Loading"
  | "Error";

function StateTile({
  state,
  children,
  note,
  className,
}: {
  state: ShowcaseState;
  children: ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">
          {state}
        </p>
        {state === "Error" ? (
          <AlertTriangle className="size-3.5 text-rose-300" aria-hidden="true" />
        ) : null}
        {state === "Loading" ? (
          <Loader2
            className="size-3.5 animate-spin text-[var(--text-muted)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
      {children}
      {note ? <p className="text-xs text-[var(--text-muted)]">{note}</p> : null}
    </div>
  );
}

function ShowcaseSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <GlassCard className="space-y-4">
      <div className="space-y-1">
        <h2 className="kpi-font text-xl font-semibold">{title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </GlassCard>
  );
}

export default function ComponentsShowroomPage() {
  const [defaultToggle, setDefaultToggle] = useState(false);
  const [activeToggle, setActiveToggle] = useState(true);
  const [defaultSlider, setDefaultSlider] = useState([34]);
  const [activeSlider, setActiveSlider] = useState([76]);
  const [period, setPeriod] = useState("week");
  const [activePeriod, setActivePeriod] = useState("month");

  if (!features.componentsShowroom) {
    return (
      <GlassCard>
        <p className="text-sm text-[var(--text-muted)]">
          Components showroom is disabled. Enable
          {" "}
          <code>NEXT_PUBLIC_FEATURE_COMPONENTS_SHOWROOM=1</code>.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="page-stack" data-testid="components-page">
      <PageHeader
        title="Components"
        subtitle="Universal component showroom with explicit states for QA, accessibility checks, and regression tests."
      />

      <FilterBar defaultPeriod="week" />

      <ShowcaseSection
        title="PrimaryButton States"
        description="Neon accent appears only for active call-to-action variants."
      >
        <StateTile state="Default">
          <PrimaryButton type="button" className="w-full">
            Create Item
          </PrimaryButton>
        </StateTile>
        <StateTile state="Hover" note="Hover preview uses elevated brightness.">
          <PrimaryButton type="button" className="w-full brightness-110">
            Hover Preview
          </PrimaryButton>
        </StateTile>
        <StateTile state="Active">
          <PrimaryButton
            type="button"
            className="w-full ring-2 ring-[#9a6fff] ring-offset-2 ring-offset-[var(--background)]"
          >
            Active
          </PrimaryButton>
        </StateTile>
        <StateTile state="Disabled">
          <PrimaryButton type="button" className="w-full" disabled>
            Disabled
          </PrimaryButton>
        </StateTile>
        <StateTile state="Loading">
          <PrimaryButton type="button" className="w-full" aria-busy="true">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading
          </PrimaryButton>
        </StateTile>
        <StateTile state="Error">
          <PrimaryButton
            type="button"
            className="w-full bg-rose-600 bg-none shadow-none hover:bg-rose-500"
          >
            Retry Failed Action
          </PrimaryButton>
        </StateTile>
      </ShowcaseSection>

      <ShowcaseSection
        title="GlassCard States"
        description="Soft glass surfaces keep consistent spacing and border rhythm across states."
      >
        <StateTile state="Default">
          <GlassCard className="p-4">
            <p className="text-sm text-[var(--text-muted)]">Default surface</p>
          </GlassCard>
        </StateTile>
        <StateTile state="Hover">
          <GlassCard interactive className="p-4 shadow-[var(--glow-shadow)]">
            <p className="text-sm text-[var(--text-muted)]">Hover preview</p>
          </GlassCard>
        </StateTile>
        <StateTile state="Active">
          <GlassCard className="border-[#9a6fff66] bg-[#9a6fff18] p-4">
            <p className="text-sm text-[var(--text)]">Active context selected</p>
          </GlassCard>
        </StateTile>
        <StateTile state="Disabled">
          <GlassCard className="pointer-events-none p-4 opacity-50">
            <p className="text-sm text-[var(--text-muted)]">Disabled block</p>
          </GlassCard>
        </StateTile>
        <StateTile state="Loading">
          <GlassCard className="space-y-2 p-4">
            <div className="skeleton h-4 rounded" aria-hidden="true" />
            <div className="skeleton h-4 w-3/4 rounded" aria-hidden="true" />
          </GlassCard>
        </StateTile>
        <StateTile state="Error">
          <GlassCard className="border-rose-400/40 bg-rose-500/10 p-4">
            <p className="text-sm text-rose-200">Failed to load card data.</p>
          </GlassCard>
        </StateTile>
      </ShowcaseSection>

      <ShowcaseSection
        title="StatCard + ProgressPill States"
        description="KPI numerals, trend indicators, and progress tracks preserve visual hierarchy in all states."
      >
        <StateTile state="Default">
          <StatCard label="Revenue" value="$92k" delta="vs previous period" />
          <ProgressPill className="mt-3" label="Pipeline" value={58} />
        </StateTile>
        <StateTile state="Hover">
          <StatCard label="Activation" value="68%" delta="hover preview" />
          <ProgressPill className="mt-3" label="Engagement" value={64} />
        </StateTile>
        <StateTile state="Active">
          <StatCard
            label="Automation Runs"
            value="312"
            delta="active"
            trendPercent={12.4}
          />
          <ProgressPill className="mt-3" label="Completion" value={86} />
        </StateTile>
        <StateTile state="Disabled">
          <div className="pointer-events-none opacity-45">
            <StatCard label="Scheduled Jobs" value="24" delta="disabled" />
            <ProgressPill className="mt-3" label="Completion" value={40} />
          </div>
        </StateTile>
        <StateTile state="Loading">
          <GlassCard className="space-y-3">
            <div className="skeleton h-4 w-1/3 rounded" aria-hidden="true" />
            <div className="skeleton h-9 w-1/2 rounded" aria-hidden="true" />
            <div className="skeleton h-6 w-2/3 rounded-full" aria-hidden="true" />
          </GlassCard>
        </StateTile>
        <StateTile state="Error">
          <GlassCard className="space-y-3 border-rose-400/40 bg-rose-500/10">
            <p className="text-sm text-rose-200">Metric feed unavailable.</p>
            <KpiTrend changePercent={-7.2} />
          </GlassCard>
        </StateTile>
      </ShowcaseSection>

      <ShowcaseSection
        title="Control Components States"
        description="Toggles, sliders, and segmented controls expose active neon only for selected values."
      >
        <StateTile state="Default">
          <ToggleSwitch
            id="showcase-toggle-default"
            label="Allow alerts"
            checked={defaultToggle}
            onCheckedChange={setDefaultToggle}
          />
          <NeonSlider
            id="showcase-slider-default"
            className="mt-4"
            label="Alert threshold"
            value={defaultSlider}
            onValueChange={setDefaultSlider}
          />
          <SegmentedControl
            className="mt-4"
            ariaLabel="Default period"
            value={period}
            onValueChange={setPeriod}
            options={[
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "Year", value: "year" },
            ]}
          />
        </StateTile>
        <StateTile state="Hover" note="Preview reflects hovered card and controls.">
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/8 p-3">
            <ToggleSwitch
              id="showcase-toggle-hover"
              label="Hover preview"
              checked={true}
              onCheckedChange={() => undefined}
            />
          </div>
        </StateTile>
        <StateTile state="Active">
          <ToggleSwitch
            id="showcase-toggle-active"
            label="Automation enabled"
            checked={activeToggle}
            onCheckedChange={setActiveToggle}
          />
          <NeonSlider
            id="showcase-slider-active"
            className="mt-4"
            label="Volume"
            value={activeSlider}
            onValueChange={setActiveSlider}
          />
          <SegmentedControl
            className="mt-4"
            ariaLabel="Active period"
            value={activePeriod}
            onValueChange={setActivePeriod}
            options={[
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "Year", value: "year" },
            ]}
          />
        </StateTile>
        <StateTile state="Disabled">
          <ToggleSwitch
            id="showcase-toggle-disabled"
            label="Disabled toggle"
            checked={false}
            onCheckedChange={() => undefined}
            disabled
          />
          <NeonSlider
            id="showcase-slider-disabled"
            className="mt-4"
            label="Disabled slider"
            value={[40]}
            onValueChange={() => undefined}
            disabled
          />
          <SegmentedControl
            className="mt-4"
            ariaLabel="Disabled segmented control"
            value="week"
            onValueChange={() => undefined}
            options={[
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "Year", value: "year" },
            ]}
            disabled
          />
        </StateTile>
        <StateTile state="Loading">
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 text-sm text-[var(--text-muted)]">
            <Loader2 className="mr-2 inline-flex size-4 animate-spin" />
            Applying control profile...
          </div>
        </StateTile>
        <StateTile state="Error">
          <div className="rounded-[var(--radius-sm)] border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle className="mr-2 inline-flex size-4" />
            Control update failed. Retry required.
          </div>
        </StateTile>
      </ShowcaseSection>

      <ShowcaseSection
        title="Search + Header + Data States"
        description="Top-level layout components and data patterns with explicit pass/fail-ready states."
      >
        <StateTile state="Default">
          <SearchBar id="search-default" placeholder="Search records" />
        </StateTile>
        <StateTile state="Hover">
          <SearchBar
            id="search-hover"
            placeholder="Hover preview"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 p-1"
          />
        </StateTile>
        <StateTile state="Active">
          <SearchBar
            id="search-active"
            placeholder="Focused search"
            className="rounded-[var(--radius-sm)] ring-2 ring-[#9a6fff]/60"
          />
        </StateTile>
        <StateTile state="Disabled">
          <SearchBar id="search-disabled" placeholder="Disabled" disabled />
        </StateTile>
        <StateTile state="Loading">
          <SearchBar
            id="search-loading"
            placeholder="Indexing records..."
            loading
          />
        </StateTile>
        <StateTile state="Error">
          <SearchBar
            id="search-error"
            placeholder="Search failed"
            error="Search backend unavailable."
          />
        </StateTile>
      </ShowcaseSection>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-xl font-semibold">DataTable Pattern</h2>
          <Badge variant="active">
            <Sparkles className="size-3.5" />
            QA
          </Badge>
        </div>
        <DataTable
          columns={[
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
            { key: "owner", label: "Owner" },
          ]}
          rows={sampleRows.map((row) => ({
            id: row.id,
            cells: [row.metric, row.value, row.owner],
          }))}
          emptyTitle="No rows to display."
          emptyDescription="Populate this table from your feature module."
        />
        <div className="rounded-[var(--radius-sm)] border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <CheckCircle2 className="mr-2 inline-flex size-4" />
          Data table passes default/hover/active/empty/error behavior checks.
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">
          Shell Component State Contract
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Navigation shell components render globally in the app layout. This
          matrix defines expected behavior for default, hover, active, disabled,
          loading, and error states.
        </p>
        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
          <table className="min-w-[980px] text-left text-xs">
            <thead className="bg-white/6 text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Component</th>
                <th className="px-3 py-2">Default</th>
                <th className="px-3 py-2">Hover</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Disabled</th>
                <th className="px-3 py-2">Loading</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {shellStateContract.map((row) => (
                <tr
                  key={row.component}
                  className="border-t border-[var(--border)] align-top"
                >
                  <td className="px-3 py-2 font-medium text-[var(--text)]">
                    {row.component}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.default}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.hover}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.active}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.disabled}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.loading}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <PageHeader
        title="PageHeader State Preview"
        subtitle="Header component is present with breadcrumb-aware context."
        action={<PrimaryButton type="button">Header Action</PrimaryButton>}
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/3 p-4"
      />
    </div>
  );
}
