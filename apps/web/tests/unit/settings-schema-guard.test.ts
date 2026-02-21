import { describe, expect, it } from "vitest";

import { isSchemaNotReadyError, isPrismaKnownErrorCode } from "@/lib/prisma-errors";

// Verifies that the helpers used to guard /settings, /washers, /calendar,
// and /assistant against a missing migration correctly classify errors.
describe("isSchemaNotReadyError", () => {
  it("returns true for P2021 (table does not exist)", () => {
    const err = Object.assign(new Error("Table 'public.UserShortcut' does not exist"), {
      code: "P2021",
    });
    expect(isSchemaNotReadyError(err)).toBe(true);
  });

  it("returns true for P2022 (column does not exist)", () => {
    const err = Object.assign(
      new Error("The column `(not available)` does not exist in the current database."),
      { code: "P2022" },
    );
    expect(isSchemaNotReadyError(err)).toBe(true);
  });

  it("returns false for P2025 (record not found) — must not swallow it", () => {
    const err = Object.assign(new Error("Record not found"), { code: "P2025" });
    expect(isSchemaNotReadyError(err)).toBe(false);
  });

  it("returns false for unrelated runtime errors", () => {
    expect(isSchemaNotReadyError(new Error("Network timeout"))).toBe(false);
    expect(isSchemaNotReadyError(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isSchemaNotReadyError(null)).toBe(false);
    expect(isSchemaNotReadyError(undefined)).toBe(false);
    expect(isSchemaNotReadyError(42)).toBe(false);
  });
});

describe("isPrismaKnownErrorCode", () => {
  it("matches exact code case-insensitively", () => {
    const err = Object.assign(new Error("msg"), { code: "p2021" });
    expect(isPrismaKnownErrorCode(err, "P2021")).toBe(true);
  });

  it("returns false when code is missing", () => {
    expect(isPrismaKnownErrorCode(new Error("msg"), "P2021")).toBe(false);
  });
});
