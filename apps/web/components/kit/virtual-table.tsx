"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { cn } from "@/lib/utils";

export type VirtualTableColumn<T> = {
  key: string;
  header: string;
  width?: string;
  render: (row: T, index: number) => React.ReactNode;
};

type VirtualTableProps<T> = {
  data: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
};

export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 44,
  maxHeight = 600,
  className,
  onRowClick,
  emptyMessage = "No data",
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual is safe here
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  if (data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-[var(--border)] bg-white/5 p-6 text-center text-sm text-[var(--text-muted)]", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-[var(--border)] bg-white/5 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex border-b border-[var(--border)] bg-white/5 px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
        {columns.map((col) => (
          <div key={col.key} className="shrink-0 px-2" style={{ width: col.width ?? "auto", flex: col.width ? "none" : 1 }}>
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index]!;
            return (
              <div
                key={virtualRow.key}
                className={cn(
                  "absolute left-0 flex w-full items-center border-b border-[var(--border)]/50 px-3 text-sm text-[var(--text)]",
                  onRowClick && "cursor-pointer hover:bg-white/5",
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={onRowClick ? () => onRowClick(row, virtualRow.index) : undefined}
              >
                {columns.map((col) => (
                  <div key={col.key} className="shrink-0 truncate px-2" style={{ width: col.width ?? "auto", flex: col.width ? "none" : 1 }}>
                    {col.render(row, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] bg-white/5 px-3 py-1.5 text-xs text-[var(--text-muted)]">
        {data.length} rows
      </div>
    </div>
  );
}
