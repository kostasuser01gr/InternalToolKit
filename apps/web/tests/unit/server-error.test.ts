import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/request-context", () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    requestId: "test-request-id",
    ipAddress: "127.0.0.1",
    userAgent: "test",
    deviceId: "test",
    route: "/settings",
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

import { mapServerError } from "@/lib/server-error";
import { AuthError } from "@/lib/rbac";

describe("mapServerError", () => {
  it("maps AuthError to its own message", async () => {
    const result = await mapServerError(
      new AuthError("Insufficient permissions"),
      "/settings",
    );

    expect(result.message).toBe("Insufficient permissions");
    expect(result.errorId).toBeTruthy();
    expect(result.requestId).toBe("test-request-id");
  });

  it("maps schema not ready errors", async () => {
    const error = Object.assign(new Error("table missing"), { code: "P2021" });
    const result = await mapServerError(error, "/settings");

    expect(result.message).toBe(
      "Database schema is not ready. Please run migrations.",
    );
  });

  it("maps connection errors", async () => {
    const error = new Error("ECONNREFUSED");
    const result = await mapServerError(error, "/settings");

    expect(result.message).toBe(
      "Database connection failed. Please check your configuration.",
    );
  });

  it("maps not-found errors to their message", async () => {
    const error = new Error("User profile not found.");
    const result = await mapServerError(error, "/settings");

    expect(result.message).toBe("User profile not found.");
  });

  it("maps unknown errors to a generic safe message", async () => {
    const result = await mapServerError("some string error", "/settings");

    expect(result.message).toBe(
      "An unexpected error occurred. Please try again.",
    );
    expect(result.errorId).toHaveLength(12);
  });
});
