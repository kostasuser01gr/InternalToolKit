/**
 * File parser — extracts rows from XLSX, CSV, JSON, and TXT files.
 * Returns an array of key-value record objects for the diff engine.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { ColumnMapping } from "./templates";

export interface ParseResult {
  rows: Record<string, unknown>[];
  headers: string[];
  sheetName?: string;
  errors: string[];
}

/**
 * Parse file content based on MIME type / extension.
 */
export function parseFileBuffer(
  buffer: Buffer,
  contentType: string,
  fileName: string,
  sheetName?: string,
): ParseResult {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "xlsx" || ext === "xls" || contentType.includes("spreadsheet")) {
    return parseXlsx(buffer, sheetName);
  }
  if (ext === "csv" || contentType === "text/csv") {
    return parseCsv(buffer.toString("utf-8"));
  }
  if (ext === "json" || contentType === "application/json") {
    return parseJson(buffer.toString("utf-8"));
  }
  if (ext === "txt" || contentType.startsWith("text/")) {
    return parseCsv(buffer.toString("utf-8")); // treat TXT as tab/comma delimited
  }

  return { rows: [], headers: [], errors: [`Unsupported file type: ${ext} (${contentType})`] };
}

function parseXlsx(buffer: Buffer, targetSheet?: string): ParseResult {
  const errors: string[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = targetSheet && workbook.SheetNames.includes(targetSheet)
      ? targetSheet
      : workbook.SheetNames[0];

    if (!sheetName) {
      return { rows: [], headers: [], errors: ["No sheets found in workbook"] };
    }

    const sheet = workbook.Sheets[sheetName]!;
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]!) : [];

    return { rows: jsonRows, headers, sheetName, errors };
  } catch (err) {
    return { rows: [], headers: [], errors: [`XLSX parse error: ${err instanceof Error ? err.message : "unknown"}`] };
  }
}

function parseCsv(text: string): ParseResult {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const errors = result.errors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`,
  );

  const headers = result.meta.fields ?? [];
  return { rows: result.data, headers, errors };
}

function parseJson(text: string): ParseResult {
  try {
    const data = JSON.parse(text);
    const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
    const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
    return { rows, headers, errors: [] };
  } catch (err) {
    return { rows: [], headers: [], errors: [`JSON parse error: ${err instanceof Error ? err.message : "unknown"}`] };
  }
}

/**
 * Apply column mappings + transforms to parsed rows.
 */
export function applyMappings(
  rows: Record<string, unknown>[],
  mappings: ColumnMapping[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const m of mappings) {
      const rawValue = row[m.sourceColumn];
      if (rawValue === undefined || rawValue === null) continue;
      mapped[m.targetField] = applyTransform(rawValue, m.transform);
    }
    return mapped;
  });
}

function applyTransform(value: unknown, transform?: string): unknown {
  if (!transform) return value;
  const str = String(value);
  switch (transform) {
    case "parseInt":
      return parseInt(str, 10) || 0;
    case "parseFloat":
      return parseFloat(str) || 0;
    case "parseDate":
      return value instanceof Date ? value.toISOString() : new Date(str).toISOString();
    case "normalizePlate":
      return str.replace(/[\s-]/g, "").toUpperCase();
    case "trim":
      return str.trim();
    case "uppercase":
      return str.toUpperCase();
    case "lowercase":
      return str.toLowerCase();
    default:
      return value;
  }
}
