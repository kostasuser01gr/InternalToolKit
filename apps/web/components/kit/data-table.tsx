import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortState = "asc" | "desc" | null;

type DataTableColumn = {
  key: string;
  label: string;
  sortHref?: string;
  sortState?: SortState;
  className?: string;
};

type DataTableRow = {
  id: string;
  cells: ReactNode[];
  actions?: ReactNode;
};

type DataTableProps = {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  actionsColumnLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
  className?: string;
};

function sortIcon(sortState: SortState) {
  if (sortState === "asc") {
    return <ArrowUp className="size-3.5" aria-hidden="true" />;
  }

  if (sortState === "desc") {
    return <ArrowDown className="size-3.5" aria-hidden="true" />;
  }

  return <ArrowUpDown className="size-3.5" aria-hidden="true" />;
}

function DataTable({
  columns,
  rows,
  actionsColumnLabel = "Actions",
  emptyTitle,
  emptyDescription,
  className,
}: DataTableProps) {
  const hasActions = rows.some((row) => row.actions);

  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]", className)}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[var(--surface-2)]/95 backdrop-blur">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={cn("whitespace-nowrap", column.className)}>
                {column.sortHref ? (
                  <Link
                    href={column.sortHref}
                    className="focus-ring inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-[var(--text)]"
                  >
                    {column.label}
                    {sortIcon(column.sortState ?? null)}
                  </Link>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
            {hasActions ? <TableHead className="w-[160px]">{actionsColumnLabel}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell key={`${row.id}-${index}`}>{cell}</TableCell>
              ))}
              {hasActions ? <TableCell>{row.actions ?? null}</TableCell> : null}
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (hasActions ? 1 : 0)}>
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-[var(--text)]">{emptyTitle}</p>
                  {emptyDescription ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{emptyDescription}</p>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export type { DataTableColumn, DataTableRow };
export { DataTable };
