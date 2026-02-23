import { describe, it, expect } from "vitest";

import { parseFileBuffer, applyMappings } from "@/lib/imports/file-parser";
import type { ColumnMapping } from "@/lib/imports/templates";

describe("Wave 12 — Import File Parser", () => {
  describe("CSV parsing", () => {
    it("parses CSV with headers", () => {
      const csv = "Name,Plate,Mileage\nToyota,ABC-1234,50000\nFord,XYZ-5678,30000";
      const result = parseFileBuffer(Buffer.from(csv), "text/csv", "test.csv");
      expect(result.rows).toHaveLength(2);
      expect(result.headers).toEqual(["Name", "Plate", "Mileage"]);
      expect(result.rows[0]).toEqual({ Name: "Toyota", Plate: "ABC-1234", Mileage: 50000 });
      expect(result.errors).toHaveLength(0);
    });

    it("handles empty CSV", () => {
      const result = parseFileBuffer(Buffer.from(""), "text/csv", "empty.csv");
      expect(result.rows).toHaveLength(0);
    });

    it("treats TXT as CSV", () => {
      const txt = "Col1,Col2\nA,B";
      const result = parseFileBuffer(Buffer.from(txt), "text/plain", "data.txt");
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ Col1: "A", Col2: "B" });
    });
  });

  describe("JSON parsing", () => {
    it("parses JSON array", () => {
      const json = JSON.stringify([{ plate: "ABC-123", model: "Toyota" }]);
      const result = parseFileBuffer(Buffer.from(json), "application/json", "data.json");
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ plate: "ABC-123", model: "Toyota" });
      expect(result.headers).toEqual(["plate", "model"]);
    });

    it("wraps single JSON object in array", () => {
      const json = JSON.stringify({ plate: "X-1" });
      const result = parseFileBuffer(Buffer.from(json), "application/json", "single.json");
      expect(result.rows).toHaveLength(1);
    });

    it("reports JSON parse errors", () => {
      const result = parseFileBuffer(Buffer.from("{invalid"), "application/json", "bad.json");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("unsupported formats", () => {
    it("returns error for unknown extensions", () => {
      const result = parseFileBuffer(Buffer.from(""), "application/octet-stream", "data.bin");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("applyMappings", () => {
    it("maps source columns to target fields", () => {
      const rows = [{ Plate: "abc-123", Model: "Toyota", Mileage: "50000" }];
      const mappings: ColumnMapping[] = [
        { sourceColumn: "Plate", targetField: "plateNumber", transform: "normalizePlate" },
        { sourceColumn: "Model", targetField: "model" },
        { sourceColumn: "Mileage", targetField: "mileageKm", transform: "parseInt" },
      ];
      const result = applyMappings(rows, mappings);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ plateNumber: "ABC123", model: "Toyota", mileageKm: 50000 });
    });

    it("handles missing source columns", () => {
      const rows = [{ Plate: "X-1" }];
      const mappings: ColumnMapping[] = [
        { sourceColumn: "Plate", targetField: "plateNumber" },
        { sourceColumn: "Missing", targetField: "other" },
      ];
      const result = applyMappings(rows, mappings);
      expect(result[0]).toEqual({ plateNumber: "X-1" });
    });

    it("applies parseDate transform", () => {
      const rows = [{ Date: "2026-01-15" }];
      const mappings: ColumnMapping[] = [
        { sourceColumn: "Date", targetField: "checkOutDate", transform: "parseDate" },
      ];
      const result = applyMappings(rows, mappings);
      expect(result[0]!.checkOutDate).toContain("2026-01-15");
    });

    it("applies uppercase transform", () => {
      const rows = [{ Name: "toyota" }];
      const mappings: ColumnMapping[] = [
        { sourceColumn: "Name", targetField: "name", transform: "uppercase" },
      ];
      const result = applyMappings(rows, mappings);
      expect(result[0]).toEqual({ name: "TOYOTA" });
    });
  });
});
