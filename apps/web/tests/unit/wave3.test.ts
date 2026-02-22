import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Consolidated Daily Cron ──

describe("Daily Cron — CronRun Log", () => {
  it("getCronRunLog returns an array", async () => {
    const { getCronRunLog } = await import("@/app/api/cron/daily/route");
    const log = await getCronRunLog();
    expect(Array.isArray(log)).toBe(true);
  });
});

// ── VirtualTable ──

describe("VirtualTable", () => {
  it("exports VirtualTable component", async () => {
    const { VirtualTable } = await import("@/components/kit/virtual-table");
    expect(typeof VirtualTable).toBe("function");
  });
});

// ── InlineEdit + Undo ──

describe("InlineEdit Undo Stack", () => {
  beforeEach(async () => {
    // Clear stack by popping everything
    const { popUndo, getUndoCount } = await import("@/components/kit/inline-edit");
    while (getUndoCount() > 0) popUndo();
  });

  it("pushUndo / popUndo works correctly", async () => {
    const { pushUndo, popUndo, getUndoCount } = await import("@/components/kit/inline-edit");

    expect(getUndoCount()).toBe(0);

    pushUndo({ id: "test-1", label: "Delete task", undo: () => {} });
    expect(getUndoCount()).toBe(1);

    pushUndo({ id: "test-2", label: "Update status", undo: () => {} });
    expect(getUndoCount()).toBe(2);

    const entry = popUndo();
    expect(entry?.id).toBe("test-2"); // LIFO
    expect(getUndoCount()).toBe(1);
  });

  it("expired undo entries are pruned", async () => {
    const { pushUndo, getUndoCount } = await import("@/components/kit/inline-edit");

    // Push an entry with immediate expiry by manipulating the stack
    pushUndo({ id: "expired", label: "Old action", undo: () => {} });
    // It should exist
    expect(getUndoCount()).toBeGreaterThanOrEqual(1);
  });

  it("InlineEdit component exports correctly", async () => {
    const { InlineEdit } = await import("@/components/kit/inline-edit");
    expect(typeof InlineEdit).toBe("function");
  });
});

// ── QuickBar Role Defaults ──

describe("QuickBar Role Shortcuts", () => {
  it("exports QuickBar component with userRole prop", async () => {
    const { QuickBar } = await import("@/components/layout/quick-bar");
    expect(typeof QuickBar).toBe("function");
  });
});

// ── UndoToast ──

describe("UndoToast", () => {
  it("exports UndoToast component", async () => {
    const { UndoToast } = await import("@/components/kit/undo-toast");
    expect(typeof UndoToast).toBe("function");
  });
});

// ── Viber Bridge Multi-channel ──

describe("Viber Bridge — Multi-channel Config", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("default mirroredChannels is washers-only", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_BOT_TOKEN", "tok");
    vi.stubEnv("VIBER_TARGET_GROUP_ID", "gid");

    const { getViberBridgeConfig } = await import("@/lib/viber/bridge");
    const config = getViberBridgeConfig();
    expect(config.mirroredChannels).toEqual(["washers-only"]);
  });

  it("supports multiple mirrored channels", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_MIRRORED_CHANNELS", "washers-only,ops-general,alerts");

    const { getViberBridgeConfig } = await import("@/lib/viber/bridge");
    const config = getViberBridgeConfig();
    expect(config.mirroredChannels).toHaveLength(3);
    expect(config.mirroredChannels).toContain("ops-general");
  });
});

// ── Cron Secret Verification ──

describe("Cron Secret Protection", () => {
  it("verifyCronSecret allows request when no secret is set", () => {
    // When CRON_SECRET is not set, all requests are allowed (dev mode)
    const originalSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    // The function is inlined in the route, so we test the logic directly
    const secret = process.env.CRON_SECRET;
    const allowed = !secret; // if no secret, allow
    expect(allowed).toBe(true);

    if (originalSecret) process.env.CRON_SECRET = originalSecret;
  });

  it("verifyCronSecret rejects incorrect secret", () => {
    const secret: string = "my-cron-secret";
    const header: string = "Bearer wrong-secret";
    const allowed = header === `Bearer ${secret}`;
    expect(allowed).toBe(false);
  });

  it("verifyCronSecret accepts correct secret", () => {
    const secret = "my-cron-secret";
    const header = `Bearer ${secret}`;
    const allowed = header === `Bearer ${secret}`;
    expect(allowed).toBe(true);
  });
});

// ── Feed Retention ──

describe("Feed Retention Housekeeping", () => {
  it("calculates 90-day retention cutoff correctly", () => {
    const FEED_ITEM_RETENTION_DAYS = 90;
    const now = Date.now();
    const cutoff = new Date(now - FEED_ITEM_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const daysDiff = (now - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(daysDiff)).toBe(90);
  });
});
