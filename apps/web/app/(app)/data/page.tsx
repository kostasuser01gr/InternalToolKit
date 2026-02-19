import { FieldType, ViewType, WorkspaceRole } from "@prisma/client";
import { ChevronLeft, ChevronRight, Eye, LayoutGrid, Plus, Upload } from "lucide-react";
import Link from "next/link";

import { DataTable } from "@/components/kit/data-table";
import { ExportButton } from "@/components/kit/export-button";
import { FilterBar } from "@/components/kit/filter-bar";
import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { parseDataQueryContract } from "@/lib/query-contract";
import { cn } from "@/lib/utils";

import {
  createFieldAction,
  createRecordAction,
  createTableAction,
  deleteFieldAction,
  deleteRecordAction,
  importCsvAction,
  updateFieldAction,
  updateRecordAction,
} from "./actions";

type DataPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    tableId?: string;
    q?: string;
    sort?: "asc" | "desc";
    sortField?: string;
    page?: string;
    pageSize?: string;
    from?: string;
    to?: string;
    period?: "week" | "month" | "year";
    viewType?: ViewType;
    editRecordId?: string;
    error?: string;
    success?: string;
    requestId?: string;
    errorId?: string;
  }>;
};

const viewTypes: ViewType[] = [
  ViewType.GRID,
  ViewType.KANBAN,
  ViewType.CALENDAR,
  ViewType.LIST,
];
const fieldTypeValues: FieldType[] = [
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.BOOLEAN,
  FieldType.DATE,
  FieldType.SELECT,
  FieldType.MULTISELECT,
];

function getString(data: unknown) {
  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data.join(", ");
  }

  if (data == null) {
    return "";
  }

  return JSON.stringify(data);
}

function DataInputField({
  field,
  defaultValue,
}: {
  field: { id: string; name: string; type: FieldType };
  defaultValue?: unknown;
}) {
  const inputName = `field_${field.id}`;
  const value = getString(defaultValue);

  if (field.type === FieldType.BOOLEAN) {
    const checked = defaultValue === true || defaultValue === "true";

    return (
      <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <input
          type="checkbox"
          name={inputName}
          defaultChecked={checked}
          value="true"
          className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
        />
        {field.name}
      </label>
    );
  }

  if (field.type === FieldType.DATE) {
    return (
      <div className="space-y-1">
        <Label htmlFor={inputName}>{field.name}</Label>
        <Input
          id={inputName}
          name={inputName}
          type="date"
          defaultValue={value}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={inputName}>{field.name}</Label>
      <Input
        id={inputName}
        name={inputName}
        defaultValue={value}
        placeholder={
          field.type === FieldType.MULTISELECT
            ? "comma,separated,values"
            : undefined
        }
      />
    </div>
  );
}

function buildQuery(
  params: Record<string, string | undefined>,
  extra: Record<string, string | undefined> = {},
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...params, ...extra })) {
    if (value) {
      query.set(key, value);
    }
  }

  return `/data?${query.toString()}`;
}

export default async function DataPage({ searchParams }: DataPageProps) {
  const params = await searchParams;
  const { workspace, workspaceRole } = await getAppContext(params.workspaceId);
  const canEdit = workspaceRole !== WorkspaceRole.VIEWER;
  const query = parseDataQueryContract({
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    sortField: params.sortField,
    q: params.q,
    from: params.from,
    to: params.to,
  });

  const tables = await db.table.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: {
        select: {
          records: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const selectedTableId = params.tableId ?? tables[0]?.id;

  const selectedTable = selectedTableId
    ? await db.table.findFirst({
        where: {
          id: selectedTableId,
          workspaceId: workspace.id,
        },
        include: {
          fields: {
            orderBy: { position: "asc" },
          },
          views: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : null;

  const activeViewType =
    params.viewType ??
    selectedTable?.views.find((view) => view.isDefault)?.type ??
    ViewType.GRID;
  const activeView = selectedTable?.views.find(
    (view) => view.type === activeViewType,
  );
  const sortDirection = query.sort;
  const sortField = query.sortField;
  const pageSize = query.pageSize;

  const recordWhere = selectedTable
    ? {
        tableId: selectedTable.id,
        ...(query.q ? { searchText: { contains: query.q } } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      }
    : null;

  const totalRecords =
    recordWhere != null
      ? await db.record.count({
          where: recordWhere,
        })
      : 0;

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const page = Math.min(totalPages, query.page);

  const recordOrderBy =
    sortField === "createdAt"
      ? [{ createdAt: sortDirection }, { id: sortDirection }]
      : [{ updatedAt: sortDirection }, { id: sortDirection }];

  const paginatedRecords =
    recordWhere != null
      ? await db.record.findMany({
          where: recordWhere,
          orderBy: recordOrderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        })
      : [];

  const editingRecord =
    selectedTable && params.editRecordId
      ? await db.record.findFirst({
          where: {
            id: params.editRecordId,
            tableId: selectedTable.id,
          },
        })
      : null;
  const viewRecords = paginatedRecords;

  const viewQueryBase = {
    workspaceId: workspace.id,
    tableId: selectedTable?.id,
    q: query.q,
    sort: sortDirection,
    sortField,
    viewType: activeViewType,
    from: params.from,
    to: params.to,
    period: params.period,
    page: String(page),
    pageSize: String(pageSize),
  };
  const exportQuery = new URLSearchParams(
    Object.entries({
      workspaceId: workspace.id,
      tableId: selectedTable?.id,
      q: query.q,
      from: params.from,
      to: params.to,
      sort: sortDirection,
      sortField,
      pageSize: String(pageSize),
    }).filter(([, value]) => Boolean(value)) as Array<[string, string]>,
  ).toString();
  const exportHref = `/data/export?${exportQuery}`;

  return (
    <div className="space-y-6" data-testid="data-page">
      <PageHeader
        title="Data Workspace"
        subtitle="Structured tables, saved views, imports, and role-safe editing for internal ops data."
      />

      <StatusBanner
        error={params.error}
        success={params.success}
        requestId={params.requestId}
        errorId={params.errorId}
      />

      <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="kpi-font text-xl font-semibold">Tables</h2>
            <Badge variant="default">{tables.length}</Badge>
          </div>

          <div className="space-y-2">
            {tables.map((table) => {
              const active = selectedTable?.id === table.id;

              return (
                <Link
                  key={table.id}
                  href={buildQuery({
                    workspaceId: workspace.id,
                    tableId: table.id,
                    q: params.q,
                    sort: sortDirection,
                    sortField,
                    viewType: params.viewType,
                    from: params.from,
                    to: params.to,
                    period: params.period,
                  })}
                  className={cn(
                    "focus-ring flex items-center justify-between rounded-[var(--radius-sm)] border border-transparent px-3 py-2 text-sm",
                    active
                      ? "border-[#9a6fff66] bg-[#9a6fff22] text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-white/6",
                  )}
                >
                  <span className="truncate">{table.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {table._count.records}
                  </span>
                </Link>
              );
            })}
            {tables.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No tables yet. Create your first schema.
              </p>
            ) : null}
          </div>

          {canEdit ? (
            <form
              action={createTableAction}
              className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3"
            >
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <div className="space-y-1">
                <Label htmlFor="table-name">Create table</Label>
                <Input
                  id="table-name"
                  name="name"
                  required
                  placeholder="Operations Queue"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="table-description">Description</Label>
                <Input
                  id="table-description"
                  name="description"
                  placeholder="What does this table track?"
                />
              </div>
              <PrimaryButton type="submit" className="w-full">
                <Plus className="size-4" />
                Create table
              </PrimaryButton>
            </form>
          ) : null}
        </GlassCard>

        <div className="space-y-4">
          {selectedTable ? (
            <>
              <GlassCard className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="kpi-font text-xl font-semibold">
                      {selectedTable.name}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      {selectedTable.description ?? "No description"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ExportButton href={exportHref} label="Export CSV" />
                    <Badge variant="active">
                      <Eye className="size-3" />
                      {activeViewType}
                    </Badge>
                  </div>
                </div>

                <FilterBar
                  defaultQuery={query.q}
                  defaultFrom={params.from}
                  defaultTo={params.to}
                  defaultPeriod={params.period ?? "week"}
                  hiddenFields={[
                    { name: "workspaceId", value: workspace.id },
                    { name: "tableId", value: selectedTable.id },
                    { name: "viewType", value: activeViewType },
                    { name: "sort", value: sortDirection },
                    { name: "sortField", value: sortField },
                    { name: "pageSize", value: String(pageSize) },
                  ]}
                />

                <div className="flex flex-wrap gap-2">
                  {viewTypes.map((viewType) => (
                    <Link
                      key={viewType}
                      href={buildQuery(viewQueryBase, { viewType })}
                      className={cn(
                        "focus-ring inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs",
                        activeViewType === viewType
                          ? "border-[#9a6fff66] bg-[#9a6fff22] text-[var(--text)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/7",
                      )}
                    >
                      <LayoutGrid className="size-3" />
                      {viewType}
                    </Link>
                  ))}
                </div>

                {activeViewType === ViewType.GRID ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>Sort:</span>
                      {(["updatedAt", "createdAt"] as const).map((option) => {
                        const isActive = sortField === option;
                        const nextDirection =
                          isActive && sortDirection === "asc" ? "desc" : "asc";

                        return (
                          <Link
                            key={option}
                            href={buildQuery(viewQueryBase, {
                              sortField: option,
                              sort: nextDirection,
                              page: "1",
                            })}
                            className={cn(
                              "focus-ring rounded-full border px-2 py-1",
                              isActive
                                ? "border-[#9a6fff66] bg-[#9a6fff22] text-[var(--text)]"
                                : "border-[var(--border)] hover:bg-white/8",
                            )}
                          >
                            {option === "updatedAt" ? "Updated time" : "Created time"}
                            {isActive ? ` (${sortDirection})` : ""}
                          </Link>
                        );
                      })}
                    </div>
                    <DataTable
                      columns={selectedTable.fields.map((field) => ({
                        key: field.id,
                        label: field.name,
                      }))}
                      rows={viewRecords.map((record) => {
                        const rowData = (record.dataJson ?? {}) as Record<
                          string,
                          unknown
                        >;

                        return {
                          id: record.id,
                          cells: selectedTable.fields.map(
                            (field) => getString(rowData[field.name]) || "-",
                          ),
                          actions: canEdit ? (
                            <div className="flex items-center gap-2">
                              <Link
                                href={buildQuery(viewQueryBase, {
                                  viewType: activeViewType,
                                  editRecordId: record.id,
                                })}
                                className="focus-ring rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-xs"
                              >
                                Edit
                              </Link>
                              <form action={deleteRecordAction}>
                                <input
                                  type="hidden"
                                  name="workspaceId"
                                  value={workspace.id}
                                />
                                <input
                                  type="hidden"
                                  name="tableId"
                                  value={selectedTable.id}
                                />
                                <input
                                  type="hidden"
                                  name="recordId"
                                  value={record.id}
                                />
                                <Button type="submit" variant="ghost" size="sm">
                                  Delete
                                </Button>
                              </form>
                            </div>
                          ) : undefined,
                        };
                      })}
                      emptyTitle="No records match current filters."
                      emptyDescription="Adjust search, date range, or view mode."
                    />

                    <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2 text-xs text-[var(--text-muted)]">
                      <p>
                        Page {page} of {totalPages} · {totalRecords} total
                        rows
                      </p>
                      <div className="flex items-center gap-1">
                        <Link
                          href={buildQuery(viewQueryBase, {
                            page: String(Math.max(1, page - 1)),
                          })}
                          aria-disabled={page <= 1}
                          className={cn(
                            "focus-ring inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1",
                            page <= 1
                              ? "pointer-events-none border-[var(--border)] opacity-40"
                              : "border-[var(--border)] hover:bg-white/8",
                          )}
                        >
                          <ChevronLeft className="size-3.5" />
                          Prev
                        </Link>
                        <Link
                          href={buildQuery(viewQueryBase, {
                            page: String(Math.min(totalPages, page + 1)),
                          })}
                          aria-disabled={page >= totalPages}
                          className={cn(
                            "focus-ring inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1",
                            page >= totalPages
                              ? "pointer-events-none border-[var(--border)] opacity-40"
                              : "border-[var(--border)] hover:bg-white/8",
                          )}
                        >
                          Next
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeViewType === ViewType.KANBAN ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {(() => {
                      const config = (activeView?.configJson ?? {}) as Record<
                        string,
                        unknown
                      >;
                      const groupField =
                        typeof config.groupBy === "string"
                          ? config.groupBy
                          : "Priority";

                      return Object.entries(
                        viewRecords.reduce<
                          Record<string, typeof viewRecords>
                        >((acc, record) => {
                          const rowData = (record.dataJson ?? {}) as Record<
                            string,
                            unknown
                          >;
                          const lane =
                            getString(rowData[groupField]) || "Uncategorized";
                          acc[lane] = [...(acc[lane] ?? []), record];
                          return acc;
                        }, {}),
                      ).map(([lane, laneRecords]) => (
                        <div
                          key={lane}
                          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-medium">{lane}</p>
                            <Badge variant="default">
                              {laneRecords.length}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {laneRecords.map((record) => {
                              const rowData = (record.dataJson ?? {}) as Record<
                                string,
                                unknown
                              >;
                              return (
                                <div
                                  key={record.id}
                                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-2 text-sm"
                                >
                                  <p>
                                    {getString(rowData.Title) || "Untitled"}
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    {groupField}:{" "}
                                    {getString(rowData[groupField]) || "n/a"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : null}

                {activeViewType === ViewType.CALENDAR ? (
                  <div className="grid gap-2">
                    {(() => {
                      const config = (activeView?.configJson ?? {}) as Record<
                        string,
                        unknown
                      >;
                      const dateField =
                        typeof config.dateField === "string"
                          ? config.dateField
                          : "DueDate";

                      return viewRecords
                        .map((record) => ({
                          record,
                          date: getString(
                            (record.dataJson as Record<string, unknown>)?.[
                              dateField
                            ],
                          ),
                        }))
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map(({ record, date }) => {
                          const rowData = (record.dataJson ?? {}) as Record<
                            string,
                            unknown
                          >;
                          return (
                            <div
                              key={record.id}
                              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
                            >
                              <p className="text-sm font-medium">
                                {getString(rowData.Title)}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {dateField}: {date || "n/a"}
                              </p>
                            </div>
                          );
                        });
                    })()}
                  </div>
                ) : null}

                {activeViewType === ViewType.LIST ? (
                  <ul className="space-y-2">
                    {viewRecords.map((record) => {
                      const rowData = (record.dataJson ?? {}) as Record<
                        string,
                        unknown
                      >;

                      return (
                        <li
                          key={record.id}
                          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2"
                        >
                          <p className="text-sm">
                            {getString(rowData.Title) || "Untitled"}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            Owner: {getString(rowData.Owner) || "n/a"}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </GlassCard>

              {canEdit ? (
                <section className="grid gap-4 lg:grid-cols-2">
                  <GlassCard className="space-y-4">
                    <h3 className="kpi-font text-lg font-semibold">
                      Add record
                    </h3>
                    <form action={createRecordAction} className="space-y-3">
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input
                        type="hidden"
                        name="tableId"
                        value={selectedTable.id}
                      />
                      {selectedTable.fields.map((field) => (
                        <DataInputField key={field.id} field={field} />
                      ))}
                      <PrimaryButton type="submit">Save record</PrimaryButton>
                    </form>
                  </GlassCard>

                  <GlassCard className="space-y-4">
                    <h3 className="kpi-font text-lg font-semibold">
                      Edit record
                    </h3>
                    {editingRecord ? (
                      <form action={updateRecordAction} className="space-y-3">
                        <input
                          type="hidden"
                          name="workspaceId"
                          value={workspace.id}
                        />
                        <input
                          type="hidden"
                          name="tableId"
                          value={selectedTable.id}
                        />
                        <input
                          type="hidden"
                          name="recordId"
                          value={editingRecord.id}
                        />
                        {selectedTable.fields.map((field) => (
                          <DataInputField
                            key={field.id}
                            field={field}
                            defaultValue={
                              (
                                editingRecord.dataJson as Record<
                                  string,
                                  unknown
                                >
                              )?.[field.name]
                            }
                          />
                        ))}
                        <PrimaryButton type="submit">
                          Update record
                        </PrimaryButton>
                      </form>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">
                        Choose “Edit” from a row in grid view to modify a record
                        inline.
                      </p>
                    )}
                  </GlassCard>
                </section>
              ) : null}

              {canEdit ? (
                <section className="grid gap-4 lg:grid-cols-2">
                  <GlassCard className="space-y-4">
                    <h3 className="kpi-font text-lg font-semibold">
                      Field editor
                    </h3>
                    <form
                      action={createFieldAction}
                      className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3"
                    >
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input
                        type="hidden"
                        name="tableId"
                        value={selectedTable.id}
                      />
                      <Input name="name" placeholder="Field name" required />
                      <Select name="type" defaultValue={FieldType.TEXT}>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldTypeValues.map((fieldType) => (
                            <SelectItem key={fieldType} value={fieldType}>
                              {fieldType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <PrimaryButton type="submit">Add field</PrimaryButton>
                    </form>

                    <div className="space-y-3">
                      {selectedTable.fields.map((field) => (
                        <div
                          key={field.id}
                          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 p-3"
                        >
                          <form
                            action={updateFieldAction}
                            className="grid gap-2 sm:grid-cols-[1fr,180px,auto]"
                          >
                            <input
                              type="hidden"
                              name="workspaceId"
                              value={workspace.id}
                            />
                            <input
                              type="hidden"
                              name="fieldId"
                              value={field.id}
                            />
                            <Input name="name" defaultValue={field.name} />
                            <Select name="type" defaultValue={field.type}>
                              <SelectTrigger>
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {fieldTypeValues.map((fieldType) => (
                                  <SelectItem key={fieldType} value={fieldType}>
                                    {fieldType}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="submit" variant="outline">
                              Save
                            </Button>
                          </form>
                          <form action={deleteFieldAction} className="mt-2">
                            <input
                              type="hidden"
                              name="workspaceId"
                              value={workspace.id}
                            />
                            <input
                              type="hidden"
                              name="fieldId"
                              value={field.id}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              Remove field
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="space-y-4">
                    <h3 className="kpi-font text-lg font-semibold">
                      Import CSV
                    </h3>
                    <form action={importCsvAction} className="space-y-3">
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input
                        type="hidden"
                        name="tableId"
                        value={selectedTable.id}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="csvText">CSV data</Label>
                        <Textarea
                          id="csvText"
                          name="csvText"
                          rows={8}
                          placeholder="Title,Priority,Owner\nAPI timeout,High,SRE"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="mappingJson">
                          Mapping JSON (column -&gt; field)
                        </Label>
                        <Textarea
                          id="mappingJson"
                          name="mappingJson"
                          rows={4}
                          placeholder='{"Title": "Title", "Priority": "Priority"}'
                        />
                      </div>
                      <PrimaryButton type="submit">
                        <Upload className="size-4" />
                        Import rows
                      </PrimaryButton>
                    </form>
                  </GlassCard>
                </section>
              ) : null}
            </>
          ) : (
            <GlassCard>
              <p className="text-sm text-[var(--text-muted)]">
                No table selected. Create a table in the left panel to start
                building records.
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
