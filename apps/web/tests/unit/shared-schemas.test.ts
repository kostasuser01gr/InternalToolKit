import { describe, expect, it } from "vitest";

import {
  assistantDraftRequestSchema,
  auditEventInputSchema,
  healthResponseSchema,
} from "@internal-toolkit/shared";

describe("shared schemas", () => {
  it("validates health response payload", () => {
    const parsed = healthResponseSchema.parse({
      ok: true,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });

    expect(parsed.ok).toBe(true);
  });

  it("rejects invalid audit payload", () => {
    const parsed = auditEventInputSchema.safeParse({
      action: "",
      entityType: "record",
      entityId: "abc",
      message: "Hello",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts assistant draft prompts above minimum length", () => {
    const parsed = assistantDraftRequestSchema.safeParse({
      prompt: "Create automation for daily report",
    });

    expect(parsed.success).toBe(true);
  });
});

