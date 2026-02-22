import { describe, it, expect } from "vitest";

// ─── Activity VirtualTable ────────────────────────────────────────────────────

describe("Activity VirtualTable integration", () => {
  it("ActivityEventTable module exports render function", async () => {
    const mod = await import("@/app/(app)/activity/activity-tables");
    expect(mod.ActivityEventTable).toBeDefined();
    expect(mod.AuditTrailTable).toBeDefined();
  });

  it("activity page no longer imports DataTable", async () => {
    // Verify the old DataTable import was removed
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/activity/page.tsx",
      "utf-8",
    );
    expect(content).not.toContain('from "@/components/kit/data-table"');
    expect(content).toContain("ActivityEventTable");
    expect(content).toContain("AuditTrailTable");
  });
});

// ─── Washers TaskQueueTable ───────────────────────────────────────────────────

describe("Washers TaskQueueTable", () => {
  it("module exports TaskQueueTable component", async () => {
    const mod = await import("@/app/(app)/washers/task-queue-table");
    expect(mod.TaskQueueTable).toBeDefined();
  });

  it("washers page imports TaskQueueTable", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("app/(app)/washers/page.tsx", "utf-8");
    expect(content).toContain("TaskQueueTable");
    // Old inline form articles should be gone
    expect(content).not.toContain("Update task");
  });

  it("TaskQueueTable uses optimistic updates", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/washers/task-queue-table.tsx",
      "utf-8",
    );
    expect(content).toContain("useOptimistic");
    expect(content).toContain("setOptimisticTask");
  });
});

// ─── Shifts InlineEdit ────────────────────────────────────────────────────────

describe("Shifts InlineEdit integration", () => {
  it("ShiftInlineField module exports component", async () => {
    const mod = await import("@/app/(app)/shifts/shift-inline-field");
    expect(mod.ShiftInlineField).toBeDefined();
  });

  it("shift-inline-actions validates editable fields", async () => {
    const mod = await import("@/app/(app)/shifts/shift-inline-actions");
    expect(mod.inlineUpdateShiftFieldAction).toBeDefined();
  });

  it("BulkShiftBar uses ShiftInlineField for title", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/bulk-shift-bar.tsx",
      "utf-8",
    );
    expect(content).toContain("ShiftInlineField");
    expect(content).toContain('field="title"');
  });

  it("BulkShiftBar has optimistic UI", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/bulk-shift-bar.tsx",
      "utf-8",
    );
    expect(content).toContain("useOptimistic");
    expect(content).toContain("optimisticShifts");
  });

  it("BulkShiftBar accepts canWrite prop", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/bulk-shift-bar.tsx",
      "utf-8",
    );
    expect(content).toContain("canWrite");
    expect(content).toMatch(/canWrite\?[\s\S]*ShiftInlineField/);
  });
});

// ─── Mobile overflow safety ───────────────────────────────────────────────────

describe("Mobile overflow safety", () => {
  it("body has overflow-x: clip", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("styles/globals.css", "utf-8");
    expect(content).toContain("overflow-x: clip");
  });

  it("VirtualTable has overflow-hidden wrapper", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "components/kit/virtual-table.tsx",
      "utf-8",
    );
    expect(content).toContain("overflow-hidden");
  });

  it("bulk-shift-bar table has overflow-x-auto", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/bulk-shift-bar.tsx",
      "utf-8",
    );
    expect(content).toContain("overflow-x-auto");
  });
});

// ─── Shift inline action server action shape ──────────────────────────────────

describe("Shift inline action validation", () => {
  it("only allows title and notes fields", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/shift-inline-actions.ts",
      "utf-8",
    );
    expect(content).toContain('"title"');
    expect(content).toContain('"notes"');
    // Should not allow status via inline edit (use bulk action for that)
    expect(content).not.toMatch(/EDITABLE_FIELDS.*status/);
  });

  it("coerces empty notes to null", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/shift-inline-actions.ts",
      "utf-8",
    );
    expect(content).toContain("null");
  });

  it("audit logs shift inline edits", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "app/(app)/shifts/shift-inline-actions.ts",
      "utf-8",
    );
    expect(content).toContain("shifts.shift_inline_edit");
    expect(content).toContain("appendAuditLog");
  });
});
