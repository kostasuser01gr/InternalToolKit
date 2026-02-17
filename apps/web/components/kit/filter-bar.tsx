"use client";

import { useState } from "react";
import { CalendarRange, Filter, Search } from "lucide-react";

import { SegmentedControl } from "@/components/kit/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterPeriod = "week" | "month" | "year";

type FilterBarProps = {
  defaultQuery?: string | undefined;
  defaultFrom?: string | undefined;
  defaultTo?: string | undefined;
  defaultPeriod?: FilterPeriod;
  queryName?: string | undefined;
  fromName?: string | undefined;
  toName?: string | undefined;
  periodName?: string | undefined;
  hiddenFields?: Array<{ name: string; value: string }>;
};

function FilterBar({
  defaultQuery,
  defaultFrom,
  defaultTo,
  defaultPeriod = "week",
  queryName = "q",
  fromName = "from",
  toName = "to",
  periodName = "period",
  hiddenFields = [],
}: FilterBarProps) {
  const [period, setPeriod] = useState<FilterPeriod>(defaultPeriod);

  return (
    <form className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 xl:grid-cols-[1fr,180px,180px,260px,auto]">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}

      <div className="relative">
        <label htmlFor={`${queryName}-filter`} className="sr-only">
          Search
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          id={`${queryName}-filter`}
          name={queryName}
          defaultValue={defaultQuery}
          placeholder="Search records"
          className="pl-9"
        />
      </div>

      <div className="relative">
        <label htmlFor={`${fromName}-filter`} className="sr-only">
          From date
        </label>
        <CalendarRange className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          id={`${fromName}-filter`}
          name={fromName}
          type="date"
          defaultValue={defaultFrom}
          className="pl-9"
        />
      </div>

      <div>
        <label htmlFor={`${toName}-filter`} className="sr-only">
          To date
        </label>
        <Input id={`${toName}-filter`} name={toName} type="date" defaultValue={defaultTo} />
      </div>

      <div>
        <input type="hidden" name={periodName} value={period} />
        <SegmentedControl
          ariaLabel="Date range period"
          value={period}
          onValueChange={(value) => setPeriod(value as FilterPeriod)}
          options={[
            { label: "This Week", value: "week" },
            { label: "Month", value: "month" },
            { label: "Year", value: "year" },
          ]}
        />
      </div>

      <Button type="submit" variant="outline">
        <Filter className="size-4" />
        Apply
      </Button>
    </form>
  );
}

export type { FilterPeriod };
export { FilterBar };
