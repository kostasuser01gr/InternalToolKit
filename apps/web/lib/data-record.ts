import type { Prisma } from "@prisma/client";

function flattenValue(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenValue(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      flattenValue(item),
    );
  }

  return [String(value)];
}

export function buildRecordSearchText(data: Record<string, Prisma.JsonValue>) {
  return flattenValue(data).join(" ").toLowerCase().slice(0, 8_000);
}

export function getRecordOpenIndicator(data: Record<string, Prisma.JsonValue>) {
  const candidates = [data.Open, data.open, data.status, data.Status];

  for (const candidate of candidates) {
    if (candidate === true) {
      return true;
    }

    if (typeof candidate === "string") {
      const normalized = candidate.trim().toLowerCase();
      if (["open", "active", "pending", "new"].includes(normalized)) {
        return true;
      }
    }
  }

  return false;
}
