import { FieldType, ViewType } from "@prisma/client";
import { z } from "zod";

export const createTableSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
});

export const createFieldSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.nativeEnum(FieldType),
});

export const updateFieldSchema = z.object({
  workspaceId: z.string().min(1),
  fieldId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.nativeEnum(FieldType),
});

export const deleteFieldSchema = z.object({
  workspaceId: z.string().min(1),
  fieldId: z.string().min(1),
});

export const createRecordSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
});

export const updateRecordSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
  recordId: z.string().min(1),
});

export const deleteRecordSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
  recordId: z.string().min(1),
});

export const importCsvSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
  csvText: z.string().min(1),
  mappingJson: z.string().optional(),
});

export const viewSwitchSchema = z.object({
  workspaceId: z.string().min(1),
  tableId: z.string().min(1),
  viewType: z.nativeEnum(ViewType),
});
