import { describe, it, expect } from "vitest";

describe("Chat Channel Actions — Edit/Delete", () => {
  it("exports editMessageAction", async () => {
    const mod = await import("@/app/(app)/chat/channel-actions");
    expect(typeof mod.editMessageAction).toBe("function");
  });

  it("exports deleteMessageAction", async () => {
    const mod = await import("@/app/(app)/chat/channel-actions");
    expect(typeof mod.deleteMessageAction).toBe("function");
  });
});

describe("Chat Channel Validators — Edit/Delete schemas", () => {
  it("editMessageSchema validates correctly", async () => {
    const { editMessageSchema } = await import("@/lib/validators/chat-channels");
    const valid = editMessageSchema.safeParse({
      workspaceId: "ws1",
      messageId: "msg1",
      content: "Updated content",
    });
    expect(valid.success).toBe(true);
  });

  it("editMessageSchema rejects empty content", async () => {
    const { editMessageSchema } = await import("@/lib/validators/chat-channels");
    const invalid = editMessageSchema.safeParse({
      workspaceId: "ws1",
      messageId: "msg1",
      content: "",
    });
    expect(invalid.success).toBe(false);
  });

  it("deleteMessageSchema validates correctly", async () => {
    const { deleteMessageSchema } = await import("@/lib/validators/chat-channels");
    const valid = deleteMessageSchema.safeParse({
      workspaceId: "ws1",
      messageId: "msg1",
    });
    expect(valid.success).toBe(true);
  });
});

describe("Viber Bridge — module exports", () => {
  it("exports mirrorToViber function", async () => {
    const mod = await import("@/lib/viber/bridge");
    expect(typeof mod.mirrorToViber).toBe("function");
  });

  it("exports getBridgeStatus function", async () => {
    const mod = await import("@/lib/viber/bridge");
    expect(typeof mod.getBridgeStatus).toBe("function");
  });

  it("exports redactSensitiveContent function", async () => {
    const mod = await import("@/lib/viber/bridge");
    expect(typeof mod.redactSensitiveContent).toBe("function");
  });

  it("redactSensitiveContent masks email addresses", async () => {
    const { redactSensitiveContent } = await import("@/lib/viber/bridge");
    const result = redactSensitiveContent("Contact john@example.com for info");
    expect(result).not.toContain("john@example.com");
  });

  it("redactSensitiveContent masks phone numbers", async () => {
    const { redactSensitiveContent } = await import("@/lib/viber/bridge");
    const result = redactSensitiveContent("Call +30 6912345678");
    expect(result).not.toContain("6912345678");
  });
});

describe("Cron Endpoints — module exports", () => {
  it("weather cron route exports GET", async () => {
    const mod = await import("@/app/api/cron/weather/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("housekeeping cron route exports GET", async () => {
    const mod = await import("@/app/api/cron/housekeeping/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("feeds cron route exports GET", async () => {
    const mod = await import("@/app/api/cron/feeds/route");
    expect(typeof mod.GET).toBe("function");
  });
});

describe("Schema — new models", () => {
  it("Generated Prisma client includes new models", async () => {
    // Verify the generated types include our new models by importing and checking
    const mod = await import("@prisma/client");
    // The FleetPipelineState and QcStatus enums should exist
    expect(mod.FleetPipelineState).toBeDefined();
    expect(mod.QcStatus).toBeDefined();
    expect(Object.values(mod.FleetPipelineState)).toContain("RETURNED");
    expect(Object.values(mod.FleetPipelineState)).toContain("BLOCKED");
    expect(Object.values(mod.QcStatus)).toContain("PASSED");
    expect(Object.values(mod.QcStatus)).toContain("FAILED");
  });
});
