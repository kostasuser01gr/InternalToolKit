import { describe, it, expect } from "vitest";

import { computeDiff, hashFileContent } from "@/lib/imports/diff-engine";
import { ALL_TEMPLATES, BOOKINGS_TEMPLATE, VEHICLES_TEMPLATE, findTemplate } from "@/lib/imports/templates";

describe("Import Diff Engine", () => {
  it("identifies creates for new records", () => {
    const parsed = [
      { plateNumber: "ABC-1234", model: "Fiat 500" },
      { plateNumber: "XYZ-5678", model: "VW Golf" },
    ];
    const existing = new Map<string, Record<string, unknown>>();

    const diff = computeDiff(parsed, existing, "plateNumber");
    expect(diff.totalRows).toBe(2);
    expect(diff.creates).toBe(2);
    expect(diff.updates).toBe(0);
    expect(diff.records[0]!.action).toBe("create");
  });

  it("identifies updates for changed records", () => {
    const parsed = [{ plateNumber: "ABC-1234", model: "Fiat Panda" }];
    const existing = new Map<string, Record<string, unknown>>([
      ["ABC-1234", { id: "v1", plateNumber: "ABC-1234", model: "Fiat 500" }],
    ]);

    const diff = computeDiff(parsed, existing, "plateNumber");
    expect(diff.updates).toBe(1);
    expect(diff.records[0]!.changes!["model"]).toEqual({ from: "Fiat 500", to: "Fiat Panda" });
  });

  it("skips unchanged records", () => {
    const parsed = [{ plateNumber: "ABC-1234", model: "Fiat 500" }];
    const existing = new Map<string, Record<string, unknown>>([
      ["ABC-1234", { id: "v1", plateNumber: "ABC-1234", model: "Fiat 500" }],
    ]);

    const diff = computeDiff(parsed, existing, "plateNumber");
    expect(diff.skips).toBe(1);
    expect(diff.records[0]!.action).toBe("skip");
  });

  it("errors on missing match key", () => {
    const parsed = [{ model: "Fiat 500" }]; // no plateNumber
    const existing = new Map<string, Record<string, unknown>>();

    const diff = computeDiff(parsed, existing, "plateNumber");
    expect(diff.errors).toBe(1);
    expect(diff.records[0]!.errorMessage).toContain("Missing match key");
  });

  it("handles mixed creates/updates/skips/errors", () => {
    const parsed = [
      { plateNumber: "NEW-001", model: "Toyota" },         // create
      { plateNumber: "EXIST-1", model: "Updated BMW" },    // update
      { plateNumber: "EXIST-2", model: "Same Model" },     // skip
      { model: "No Plate" },                                // error
    ];
    const existing = new Map<string, Record<string, unknown>>([
      ["EXIST-1", { id: "v2", plateNumber: "EXIST-1", model: "Old BMW" }],
      ["EXIST-2", { id: "v3", plateNumber: "EXIST-2", model: "Same Model" }],
    ]);

    const diff = computeDiff(parsed, existing, "plateNumber");
    expect(diff.totalRows).toBe(4);
    expect(diff.creates).toBe(1);
    expect(diff.updates).toBe(1);
    expect(diff.skips).toBe(1);
    expect(diff.errors).toBe(1);
  });
});

describe("Import File Hash", () => {
  it("produces consistent hash for same content", async () => {
    const content = new TextEncoder().encode("test data");
    const hash1 = await hashFileContent(content.buffer as ArrayBuffer);
    const hash2 = await hashFileContent(content.buffer as ArrayBuffer);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("produces different hash for different content", async () => {
    const c1 = new TextEncoder().encode("data A");
    const c2 = new TextEncoder().encode("data B");
    const h1 = await hashFileContent(c1.buffer as ArrayBuffer);
    const h2 = await hashFileContent(c2.buffer as ArrayBuffer);
    expect(h1).not.toBe(h2);
  });
});

describe("Import Templates", () => {
  it("has bookings and vehicles templates", () => {
    expect(ALL_TEMPLATES).toHaveLength(2);
    expect(BOOKINGS_TEMPLATE.importType).toBe("bookings");
    expect(VEHICLES_TEMPLATE.importType).toBe("fleet");
  });

  it("findTemplate returns correct template", () => {
    expect(findTemplate("bookings")).toBe(BOOKINGS_TEMPLATE);
    expect(findTemplate("fleet")).toBe(VEHICLES_TEMPLATE);
    expect(findTemplate("unknown")).toBeUndefined();
  });

  it("bookings template has plateNumber-relevant mappings", () => {
    const fieldNames = BOOKINGS_TEMPLATE.mappings.map((m) => m.targetField);
    expect(fieldNames).toContain("checkOutDate");
    expect(fieldNames).toContain("confirmationNumber");
  });

  it("vehicles template maps plateNumber", () => {
    const plateMapping = VEHICLES_TEMPLATE.mappings.find(
      (m) => m.targetField === "plateNumber",
    );
    expect(plateMapping).toBeDefined();
    expect(plateMapping!.sourceColumn).toBe("Plate");
    expect(plateMapping!.transform).toBe("normalizePlate");
  });
});

describe("Import Apply Engine — module exports", () => {
  it("exports applyFleetDiff", async () => {
    const mod = await import("@/lib/imports/apply-engine");
    expect(typeof mod.applyFleetDiff).toBe("function");
  });

  it("exports rollbackBatch", async () => {
    const mod = await import("@/lib/imports/apply-engine");
    expect(typeof mod.rollbackBatch).toBe("function");
  });
});
