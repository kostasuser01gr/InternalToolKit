import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CHAT_SCHEMA_NOT_READY_MESSAGE,
  getChatErrorMessage,
} from "@/lib/chat-error-message";
import { AuthError } from "@/lib/rbac";

describe("getChatErrorMessage", () => {
  it("returns auth error message", () => {
    expect(getChatErrorMessage(new AuthError("No workspace access found."))).toBe(
      "No workspace access found.",
    );
  });

  it("returns first zod issue message", () => {
    const schema = z.object({ content: z.string().min(5) });
    const parsed = schema.safeParse({ content: "abc" });

    if (parsed.success) {
      throw new Error("Expected validation to fail.");
    }

    expect(getChatErrorMessage(parsed.error)).toBe(
      parsed.error.issues[0]?.message,
    );
  });

  it("maps schema-not-ready prisma errors to operational guidance", () => {
    const error = Object.assign(new Error("The table does not exist"), {
      code: "P2021",
    });

    expect(getChatErrorMessage(error)).toBe(CHAT_SCHEMA_NOT_READY_MESSAGE);
  });

  it("returns generic error message for unknown errors", () => {
    expect(getChatErrorMessage(new Error("Unexpected failure"))).toBe(
      "Unexpected failure",
    );
    expect(getChatErrorMessage({ foo: "bar" })).toBe("Unexpected error.");
  });
});
