import { createHash } from "crypto";

import { workspacePermissionMatrix } from "@/lib/rbac";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function getRbacDriftStatus() {
  const snapshot = stableStringify(workspacePermissionMatrix);
  const currentHash = createHash("sha256").update(snapshot).digest("hex");
  const baselineHash = process.env.RBAC_BASELINE_HASH?.trim() || currentHash;

  return {
    driftDetected: baselineHash !== currentHash,
    baselineHash,
    currentHash,
  };
}
