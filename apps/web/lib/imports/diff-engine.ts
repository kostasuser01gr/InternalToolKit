/**
 * Diff engine for file imports.
 * Compares parsed import data against existing records to produce
 * create/update/archive proposals.
 */

export interface DiffRecord {
  rowIndex: number;
  action: "create" | "update" | "archive" | "skip" | "error";
  sourceData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
  matchKey?: string;
  matchedId?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  errorMessage?: string;
}

export interface DiffSummary {
  totalRows: number;
  creates: number;
  updates: number;
  archives: number;
  skips: number;
  errors: number;
  records: DiffRecord[];
}

export function computeDiff(
  parsedRows: Record<string, unknown>[],
  existingRecords: Map<string, Record<string, unknown>>,
  matchKeyField: string,
): DiffSummary {
  const summary: DiffSummary = {
    totalRows: parsedRows.length,
    creates: 0,
    updates: 0,
    archives: 0,
    skips: 0,
    errors: 0,
    records: [],
  };

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i]!;
    const key = row[matchKeyField];

    if (key === undefined || key === null || key === "") {
      summary.records.push({
        rowIndex: i,
        action: "error",
        sourceData: row,
        mappedData: row,
        errorMessage: `Missing match key "${matchKeyField}"`,
      });
      summary.errors++;
      continue;
    }

    const keyStr = String(key);
    const existing = existingRecords.get(keyStr);

    if (!existing) {
      summary.records.push({
        rowIndex: i,
        action: "create",
        sourceData: row,
        mappedData: row,
        matchKey: keyStr,
      });
      summary.creates++;
    } else {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      let hasChanges = false;

      for (const [field, newValue] of Object.entries(row)) {
        if (field === matchKeyField) continue;
        const oldValue = existing[field];
        if (newValue !== undefined && newValue !== null && String(newValue) !== String(oldValue ?? "")) {
          changes[field] = { from: oldValue, to: newValue };
          hasChanges = true;
        }
      }

      if (hasChanges) {
        const existingId = typeof existing["id"] === "string" ? existing["id"] : undefined;
        const record: DiffRecord = {
          rowIndex: i,
          action: "update",
          sourceData: row,
          mappedData: row,
          matchKey: keyStr,
          changes,
        };
        if (existingId) record.matchedId = existingId;
        summary.records.push(record);
        summary.updates++;
      } else {
        summary.records.push({
          rowIndex: i,
          action: "skip",
          sourceData: row,
          mappedData: row,
          matchKey: keyStr,
        });
        summary.skips++;
      }
    }
  }

  return summary;
}

/**
 * Generate a stable file hash from content for idempotency checks.
 */
export async function hashFileContent(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
