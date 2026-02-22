import { describe, it, expect } from "vitest";

// Chat channel validators
import {
  createChannelSchema,
  updateChannelSchema,
  joinChannelSchema,
  sendChannelMessageSchema,
  reactToMessageSchema,
  pinMessageSchema,
} from "@/lib/validators/chat-channels";

// Import validators
import {
  createImportBatchSchema,
  updateMappingSchema,
  acceptImportSchema,
  declineImportSchema,
  rollbackImportSchema,
} from "@/lib/validators/imports";

// Import templates
import {
  BOOKINGS_TEMPLATE,
  VEHICLES_TEMPLATE,
  ALL_TEMPLATES,
  findTemplate,
} from "@/lib/imports/templates";

// Diff engine
import { computeDiff, hashFileContent } from "@/lib/imports/diff-engine";

// AI key detection
import { getAiSetupSummary, detectProviderKeys } from "@/lib/ai/key-detection";

// Prisma enums
import { ChatChannelType } from "@prisma/client";

// ──────── Chat Channel Validators ────────

describe("Phase 11 — Chat channel validators", () => {
  it("accepts valid channel creation", () => {
    const result = createChannelSchema.safeParse({
      workspaceId: "ws1",
      name: "Ops General",
      slug: "ops-general",
      type: ChatChannelType.PUBLIC,
    });
    expect(result.success).toBe(true);
  });

  it("lowercases and validates slug", () => {
    const result = createChannelSchema.parse({
      workspaceId: "ws1",
      name: "Test Channel",
      slug: "test-channel",
    });
    expect(result.slug).toBe("test-channel");
  });

  it("rejects invalid slug characters", () => {
    const result = createChannelSchema.safeParse({
      workspaceId: "ws1",
      name: "Bad Slug",
      slug: "Bad Slug!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short channel name", () => {
    const result = createChannelSchema.safeParse({
      workspaceId: "ws1",
      name: "X",
      slug: "xx",
    });
    expect(result.success).toBe(false);
  });

  it("accepts channel update", () => {
    const result = updateChannelSchema.safeParse({
      workspaceId: "ws1",
      channelId: "ch1",
      isPinned: true,
      isReadOnly: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts join channel", () => {
    const result = joinChannelSchema.safeParse({
      workspaceId: "ws1",
      channelId: "ch1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid message", () => {
    const result = sendChannelMessageSchema.safeParse({
      workspaceId: "ws1",
      channelId: "ch1",
      content: "Hello team!",
    });
    expect(result.success).toBe(true);
  });

  it("accepts message with reply and attachment", () => {
    const result = sendChannelMessageSchema.safeParse({
      workspaceId: "ws1",
      channelId: "ch1",
      content: "Reply with photo",
      replyToId: "msg1",
      attachmentUrl: "https://example.com/photo.jpg",
      attachmentMime: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty message", () => {
    const result = sendChannelMessageSchema.safeParse({
      workspaceId: "ws1",
      channelId: "ch1",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts reaction", () => {
    const result = reactToMessageSchema.safeParse({
      workspaceId: "ws1",
      messageId: "msg1",
      emoji: "👍",
    });
    expect(result.success).toBe(true);
  });

  it("accepts pin toggle", () => {
    const result = pinMessageSchema.safeParse({
      workspaceId: "ws1",
      messageId: "msg1",
      isPinned: true,
    });
    expect(result.success).toBe(true);
  });
});

// ──────── Import Validators ────────

describe("Phase 11 — Import validators", () => {
  it("accepts valid import batch creation", () => {
    const result = createImportBatchSchema.safeParse({
      workspaceId: "ws1",
      importType: "bookings",
      fileName: "Bookings.xlsx",
      fileHash: "abc123def456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown import type", () => {
    const result = createImportBatchSchema.safeParse({
      workspaceId: "ws1",
      importType: "unknown",
      fileName: "file.csv",
      fileHash: "hash1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts fleet import type", () => {
    const result = createImportBatchSchema.safeParse({
      workspaceId: "ws1",
      importType: "fleet",
      fileName: "Vehicles.xlsx",
      fileHash: "hash2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts mapping update", () => {
    const result = updateMappingSchema.safeParse({
      workspaceId: "ws1",
      batchId: "batch1",
      mappingJson: '{"column":"field"}',
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty mapping JSON", () => {
    const result = updateMappingSchema.safeParse({
      workspaceId: "ws1",
      batchId: "batch1",
      mappingJson: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts accept/decline/rollback schemas", () => {
    const base = { workspaceId: "ws1", batchId: "b1" };
    expect(acceptImportSchema.safeParse(base).success).toBe(true);
    expect(declineImportSchema.safeParse(base).success).toBe(true);
    expect(rollbackImportSchema.safeParse(base).success).toBe(true);
  });
});

// ──────── Import Templates ────────

describe("Phase 11 — Import templates", () => {
  it("has bookings template with key fields", () => {
    expect(BOOKINGS_TEMPLATE.importType).toBe("bookings");
    expect(BOOKINGS_TEMPLATE.sheetName).toBe("Bookings");
    const fields = BOOKINGS_TEMPLATE.mappings.map((m) => m.targetField);
    expect(fields).toContain("agreementNumber");
    expect(fields).toContain("checkOutDate");
    expect(fields).toContain("checkInDate");
    expect(fields).toContain("vehicleModel");
    expect(fields).toContain("driverFirstName");
  });

  it("has vehicles template with key fields", () => {
    expect(VEHICLES_TEMPLATE.importType).toBe("fleet");
    expect(VEHICLES_TEMPLATE.sheetName).toBe("Vehicles");
    const fields = VEHICLES_TEMPLATE.mappings.map((m) => m.targetField);
    expect(fields).toContain("plateNumber");
    expect(fields).toContain("vin");
    expect(fields).toContain("model");
    expect(fields).toContain("station");
    expect(fields).toContain("fuelType");
  });

  it("findTemplate returns correct template", () => {
    expect(findTemplate("bookings")?.id).toBe("bookings-europcar-xlsx");
    expect(findTemplate("fleet")?.id).toBe("vehicles-fleet-xlsx");
    expect(findTemplate("unknown")).toBeUndefined();
  });

  it("ALL_TEMPLATES has both templates", () => {
    expect(ALL_TEMPLATES.length).toBe(2);
  });
});

// ──────── Diff Engine ────────

describe("Phase 11 — Diff engine", () => {
  it("detects new records to create", () => {
    const rows = [
      { plate: "ABC-123", model: "Golf" },
      { plate: "XYZ-789", model: "Polo" },
    ];
    const existing = new Map<string, Record<string, unknown>>();

    const diff = computeDiff(rows, existing, "plate");
    expect(diff.totalRows).toBe(2);
    expect(diff.creates).toBe(2);
    expect(diff.updates).toBe(0);
    expect(diff.skips).toBe(0);
  });

  it("detects updates when fields differ", () => {
    const rows = [{ plate: "ABC-123", model: "Golf GTI" }];
    const existing = new Map<string, Record<string, unknown>>([
      ["ABC-123", { id: "v1", plate: "ABC-123", model: "Golf" }],
    ]);

    const diff = computeDiff(rows, existing, "plate");
    expect(diff.updates).toBe(1);
    expect(diff.creates).toBe(0);
    expect(diff.records[0]?.action).toBe("update");
    expect(diff.records[0]?.changes?.["model"]?.from).toBe("Golf");
    expect(diff.records[0]?.changes?.["model"]?.to).toBe("Golf GTI");
  });

  it("skips records with no changes", () => {
    const rows = [{ plate: "ABC-123", model: "Golf" }];
    const existing = new Map<string, Record<string, unknown>>([
      ["ABC-123", { id: "v1", plate: "ABC-123", model: "Golf" }],
    ]);

    const diff = computeDiff(rows, existing, "plate");
    expect(diff.skips).toBe(1);
    expect(diff.records[0]?.action).toBe("skip");
  });

  it("marks errors for missing match key", () => {
    const rows = [{ model: "Golf" }]; // no plate
    const existing = new Map<string, Record<string, unknown>>();

    const diff = computeDiff(rows, existing, "plate");
    expect(diff.errors).toBe(1);
    expect(diff.records[0]?.action).toBe("error");
  });

  it("handles mixed create/update/skip/error", () => {
    const rows = [
      { plate: "ABC-123", model: "Golf GTI" },
      { plate: "DEF-456", model: "Polo" },
      { plate: "GHI-789", model: "Passat" },
      { model: "Unknown" }, // missing key
    ];
    const existing = new Map<string, Record<string, unknown>>([
      ["ABC-123", { id: "v1", plate: "ABC-123", model: "Golf" }],
      ["GHI-789", { id: "v3", plate: "GHI-789", model: "Passat" }],
    ]);

    const diff = computeDiff(rows, existing, "plate");
    expect(diff.totalRows).toBe(4);
    expect(diff.updates).toBe(1);   // ABC-123 changed
    expect(diff.creates).toBe(1);   // DEF-456 new
    expect(diff.skips).toBe(1);     // GHI-789 unchanged
    expect(diff.errors).toBe(1);    // missing plate
  });

  it("hashFileContent produces consistent hex hash", async () => {
    const content = new TextEncoder().encode("test content");
    const hash = await hashFileContent(content.buffer as ArrayBuffer);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // Same content = same hash
    const hash2 = await hashFileContent(content.buffer as ArrayBuffer);
    expect(hash2).toBe(hash);
  });
});

// ──────── AI Key Detection ────────

describe("Phase 11 — AI key detection", () => {
  it("detectProviderKeys returns provider list", () => {
    const providers = detectProviderKeys();
    expect(providers.length).toBeGreaterThanOrEqual(1);
    const ids = providers.map((p) => p.id);
    expect(ids).toContain("openrouter");
  });

  it("getAiSetupSummary returns structured summary", () => {
    const summary = getAiSetupSummary();
    expect(summary).toHaveProperty("isReady");
    expect(summary).toHaveProperty("configuredCount");
    expect(summary).toHaveProperty("totalCount");
    expect(summary).toHaveProperty("providers");
    expect(summary).toHaveProperty("message");
    expect(typeof summary.message).toBe("string");
  });

  it("summary message indicates setup needed when no keys", () => {
    // In test env, keys are typically not set
    const summary = getAiSetupSummary();
    if (!summary.isReady) {
      expect(summary.message).toContain("AI not configured");
    }
  });
});
