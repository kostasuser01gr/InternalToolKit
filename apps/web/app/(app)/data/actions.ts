"use server";

import { FieldType, Prisma, ViewType, WorkspaceRole } from "@prisma/client";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { USAGE_LIMITS } from "@/lib/constants/limits";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspaceRole } from "@/lib/rbac";
import { logSecurityEvent } from "@/lib/security";
import {
  createFieldSchema,
  createRecordSchema,
  createTableSchema,
  deleteFieldSchema,
  deleteRecordSchema,
  importCsvSchema,
  updateFieldSchema,
  updateRecordSchema,
} from "@/lib/validators/data";

function buildDataUrl(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();

  return query ? `/data?${query}` : "/data";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

function parseFieldValue(type: FieldType, value: FormDataEntryValue | null) {
  if (type === FieldType.BOOLEAN) {
    const rawBoolean = typeof value === "string" ? value.trim() : "";
    return rawBoolean === "true" || rawBoolean === "on";
  }

  const raw = typeof value === "string" ? value.trim() : "";

  if (raw.length === 0) {
    return null;
  }

  switch (type) {
    case FieldType.NUMBER:
      return Number.isNaN(Number(raw)) ? null : Number(raw);
    case FieldType.MULTISELECT:
      return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    default:
      return raw;
  }
}

async function ensureTableAccess(workspaceId: string, tableId: string) {
  const table = await db.table.findFirst({
    where: {
      id: tableId,
      workspaceId,
    },
    include: {
      fields: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!table) {
    throw new Error("Table not found in workspace.");
  }

  return table;
}

export async function createTableAction(formData: FormData) {
  const parsed = createTableSchema.parse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const tableCount = await db.table.count({
      where: { workspaceId: parsed.workspaceId },
    });

    if (tableCount >= USAGE_LIMITS.maxTablesPerWorkspace) {
      throw new Error(
        `Table limit reached (${USAGE_LIMITS.maxTablesPerWorkspace}). Upgrade limit in guardrails.`,
      );
    }

    const table = await db.table.create({
      data: {
        workspaceId: parsed.workspaceId,
        name: parsed.name,
        description: parsed.description ?? null,
      },
    });

    await db.view.createMany({
      data: [
        {
          tableId: table.id,
          name: "Grid",
          type: ViewType.GRID,
          configJson: {},
          isDefault: true,
        },
        {
          tableId: table.id,
          name: "Kanban",
          type: ViewType.KANBAN,
          configJson: { groupBy: "Status" },
          isDefault: false,
        },
        {
          tableId: table.id,
          name: "Calendar",
          type: ViewType.CALENDAR,
          configJson: { dateField: "Date" },
          isDefault: false,
        },
        {
          tableId: table.id,
          name: "List",
          type: ViewType.LIST,
          configJson: {},
          isDefault: false,
        },
      ],
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "table.created",
      entityType: "table",
      entityId: table.id,
      metaJson: {
        name: parsed.name,
      },
    });

    logSecurityEvent("mutation.table_created", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      tableId: table.id,
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: table.id,
        success: "Table created.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function createFieldAction(formData: FormData) {
  const parsed = createFieldSchema.parse({
    workspaceId: formData.get("workspaceId"),
    tableId: formData.get("tableId"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const table = await ensureTableAccess(parsed.workspaceId, parsed.tableId);

    await db.field.create({
      data: {
        tableId: table.id,
        name: parsed.name,
        type: parsed.type,
        position: table.fields.length,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "field.created",
      entityType: "field",
      entityId: table.id,
      metaJson: { tableId: table.id, name: parsed.name, type: parsed.type },
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        success: "Field created.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function updateFieldAction(formData: FormData) {
  const parsed = updateFieldSchema.parse({
    workspaceId: formData.get("workspaceId"),
    fieldId: formData.get("fieldId"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const field = await db.field.findFirst({
      where: {
        id: parsed.fieldId,
        table: { workspaceId: parsed.workspaceId },
      },
    });

    if (!field) {
      throw new Error("Field not found.");
    }

    await db.field.update({
      where: { id: field.id },
      data: {
        name: parsed.name,
        type: parsed.type,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "field.updated",
      entityType: "field",
      entityId: field.id,
      metaJson: { name: parsed.name, type: parsed.type },
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: field.tableId,
        success: "Field updated.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function deleteFieldAction(formData: FormData) {
  const parsed = deleteFieldSchema.parse({
    workspaceId: formData.get("workspaceId"),
    fieldId: formData.get("fieldId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const field = await db.field.findFirst({
      where: {
        id: parsed.fieldId,
        table: { workspaceId: parsed.workspaceId },
      },
    });

    if (!field) {
      throw new Error("Field not found.");
    }

    await db.field.delete({ where: { id: field.id } });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "field.deleted",
      entityType: "field",
      entityId: field.id,
      metaJson: { tableId: field.tableId },
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: field.tableId,
        success: "Field removed.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function createRecordAction(formData: FormData) {
  const parsed = createRecordSchema.parse({
    workspaceId: formData.get("workspaceId"),
    tableId: formData.get("tableId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const table = await ensureTableAccess(parsed.workspaceId, parsed.tableId);
    const count = await db.record.count({ where: { tableId: table.id } });

    if (count >= USAGE_LIMITS.maxRecordsPerTable) {
      throw new Error(
        `Record limit reached (${USAGE_LIMITS.maxRecordsPerTable}) for this table.`,
      );
    }

    const payload: Record<string, Prisma.JsonValue> = {};

    for (const field of table.fields) {
      payload[field.name] = parseFieldValue(
        field.type,
        formData.get(`field_${field.id}`),
      );
    }

    const record = await db.record.create({
      data: {
        tableId: table.id,
        dataJson: payload,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "record.created",
      entityType: "record",
      entityId: record.id,
      metaJson: { tableId: table.id },
    });

    logSecurityEvent("mutation.record_created", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      tableId: table.id,
      recordId: record.id,
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        success: "Record created.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function updateRecordAction(formData: FormData) {
  const parsed = updateRecordSchema.parse({
    workspaceId: formData.get("workspaceId"),
    tableId: formData.get("tableId"),
    recordId: formData.get("recordId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const table = await ensureTableAccess(parsed.workspaceId, parsed.tableId);

    const record = await db.record.findFirst({
      where: { id: parsed.recordId, tableId: table.id },
    });

    if (!record) {
      throw new Error("Record not found.");
    }

    const payload: Record<string, Prisma.JsonValue> = {};

    for (const field of table.fields) {
      payload[field.name] = parseFieldValue(
        field.type,
        formData.get(`field_${field.id}`),
      );
    }

    await db.record.update({
      where: { id: record.id },
      data: { dataJson: payload },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "record.updated",
      entityType: "record",
      entityId: record.id,
      metaJson: { tableId: table.id },
    });

    logSecurityEvent("mutation.record_updated", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      tableId: table.id,
      recordId: record.id,
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        success: "Record updated.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function deleteRecordAction(formData: FormData) {
  const parsed = deleteRecordSchema.parse({
    workspaceId: formData.get("workspaceId"),
    tableId: formData.get("tableId"),
    recordId: formData.get("recordId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const record = await db.record.findFirst({
      where: {
        id: parsed.recordId,
        tableId: parsed.tableId,
        table: {
          workspaceId: parsed.workspaceId,
        },
      },
    });

    if (!record) {
      throw new Error("Record not found.");
    }

    await db.record.delete({ where: { id: record.id } });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "record.deleted",
      entityType: "record",
      entityId: record.id,
      metaJson: { tableId: parsed.tableId },
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        success: "Record removed.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function importCsvAction(formData: FormData) {
  const parsed = importCsvSchema.parse({
    workspaceId: formData.get("workspaceId"),
    tableId: formData.get("tableId"),
    csvText: formData.get("csvText"),
    mappingJson: formData.get("mappingJson") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const table = await ensureTableAccess(parsed.workspaceId, parsed.tableId);

    const parsedCsv = Papa.parse<Record<string, string>>(parsed.csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsedCsv.errors.length > 0) {
      throw new Error(parsedCsv.errors[0]?.message ?? "CSV parsing failed.");
    }

    const rows = parsedCsv.data;

    if (rows.length === 0) {
      throw new Error("CSV has no data rows.");
    }

    const mapping = parsed.mappingJson
      ? z.record(z.string(), z.string()).parse(JSON.parse(parsed.mappingJson))
      : {};

    const fieldMap = new Map(table.fields.map((field) => [field.name, field]));
    let nextPosition = table.fields.length;

    const headers = Object.keys(rows[0] ?? {});

    for (const header of headers) {
      const mappedFieldName = mapping[header] ?? header;

      if (!fieldMap.has(mappedFieldName)) {
        const newField = await db.field.create({
          data: {
            tableId: table.id,
            name: mappedFieldName,
            type: FieldType.TEXT,
            position: nextPosition,
          },
        });

        fieldMap.set(mappedFieldName, newField);
        nextPosition += 1;
      }
    }

    const existingCount = await db.record.count({
      where: { tableId: table.id },
    });

    if (existingCount + rows.length > USAGE_LIMITS.maxRecordsPerTable) {
      throw new Error(
        `Import exceeds record limit (${USAGE_LIMITS.maxRecordsPerTable}). Reduce rows before importing.`,
      );
    }

    await db.record.createMany({
      data: rows.map((row) => {
        const data: Record<string, Prisma.JsonValue> = {};

        for (const [header, value] of Object.entries(row)) {
          const mappedName = mapping[header] ?? header;
          data[mappedName] = value;
        }

        return {
          tableId: table.id,
          dataJson: data,
        };
      }),
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "record.csv_imported",
      entityType: "table",
      entityId: table.id,
      metaJson: {
        rows: rows.length,
      },
    });

    logSecurityEvent("mutation.csv_import", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      tableId: table.id,
      rows: rows.length,
    });

    revalidatePath("/data");
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        success: `Imported ${rows.length} records.`,
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildDataUrl({
        workspaceId: parsed.workspaceId,
        tableId: parsed.tableId,
        error: getErrorMessage(error),
      }),
    );
  }
}
