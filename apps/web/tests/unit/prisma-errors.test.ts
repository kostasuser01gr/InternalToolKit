import { describe, expect, it } from "vitest";

import {
  isConnectionError,
  isPrismaKnownErrorCode,
  isSchemaNotReadyError,
} from "@/lib/prisma-errors";

describe("isPrismaKnownErrorCode", () => {
  it("matches prisma error code case-insensitively", () => {
    const error = Object.assign(new Error("table missing"), {
      code: "p2021",
    });

    expect(isPrismaKnownErrorCode(error, "P2021")).toBe(true);
  });

  it("returns false for non-matching code", () => {
    const error = Object.assign(new Error("other"), {
      code: "P1001",
    });

    expect(isPrismaKnownErrorCode(error, "P2021")).toBe(false);
  });
});

describe("isConnectionError", () => {
  it("detects ECONNREFUSED", () => {
    expect(isConnectionError(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(true);
  });

  it("detects ETIMEDOUT", () => {
    expect(isConnectionError(new Error("connect ETIMEDOUT"))).toBe(true);
  });

  it("ignores schema errors", () => {
    expect(isConnectionError(new Error('relation "Foo" does not exist'))).toBe(false);
  });
});

describe("isSchemaNotReadyError", () => {
  it("detects prisma P2021 errors", () => {
    const error = Object.assign(new Error("table missing"), {
      code: "P2021",
    });

    expect(isSchemaNotReadyError(error)).toBe(true);
  });

  it("detects prisma P2022 errors", () => {
    const error = Object.assign(new Error("column missing"), {
      code: "P2022",
    });

    expect(isSchemaNotReadyError(error)).toBe(true);
  });

  it("detects message-based relation missing errors", () => {
    const error = new Error('relation "PromptTemplate" does not exist');

    expect(isSchemaNotReadyError(error)).toBe(true);
  });

  it("ignores unrelated errors", () => {
    const error = new Error("connection timeout");

    expect(isSchemaNotReadyError(error)).toBe(false);
  });

  it("returns false for connection errors even with P2021 code", () => {
    const error = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "P2021",
    });
    expect(isSchemaNotReadyError(error)).toBe(false);
  });
});
