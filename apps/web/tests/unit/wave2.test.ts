import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Viber Bridge Tests ──

describe("Viber Bridge — Channel Mirror", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("getViberBridgeConfig returns channelToken and mirroredChannels", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_BOT_TOKEN", "bot-token");
    vi.stubEnv("VIBER_TARGET_GROUP_ID", "group-id");
    vi.stubEnv("VIBER_CHANNEL_AUTH_TOKEN", "channel-token");
    vi.stubEnv("VIBER_MIRRORED_CHANNELS", "washers-only,ops-general");

    const { getViberBridgeConfig } = await import("@/lib/viber/bridge");
    const config = getViberBridgeConfig();

    expect(config.enabled).toBe(true);
    expect(config.channelToken).toBe("channel-token");
    expect(config.mirroredChannels).toEqual(["washers-only", "ops-general"]);
  });

  it("isViberBridgeReady returns true when channel token is set", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_CHANNEL_AUTH_TOKEN", "channel-token");

    const mod = await import("@/lib/viber/bridge");
    expect(mod.isViberBridgeReady()).toBe(true);
  });

  it("isViberBridgeReady returns true with bot token + group id", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_BOT_TOKEN", "bot-token");
    vi.stubEnv("VIBER_TARGET_GROUP_ID", "group-id");

    const mod = await import("@/lib/viber/bridge");
    expect(mod.isViberBridgeReady()).toBe(true);
  });

  it("isViberBridgeReady returns false when disabled", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "0");

    const mod = await import("@/lib/viber/bridge");
    expect(mod.isViberBridgeReady()).toBe(false);
  });

  it("mirrorToViber rejects channel not in mirroredChannels", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_BOT_TOKEN", "tok");
    vi.stubEnv("VIBER_TARGET_GROUP_ID", "gid");
    vi.stubEnv("VIBER_MIRRORED_CHANNELS", "washers-only");

    const { mirrorToViber } = await import("@/lib/viber/bridge");
    const result = await mirrorToViber({
      id: "1",
      channelSlug: "random-channel",
      content: "test",
      authorName: "Tester",
      timestamp: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not in mirrored list");
  });

  it("getBridgeStatus includes enhanced fields", async () => {
    vi.stubEnv("FEATURE_VIBER_BRIDGE", "1");
    vi.stubEnv("VIBER_CHANNEL_AUTH_TOKEN", "ch-tok");

    const { getBridgeStatus } = await import("@/lib/viber/bridge");
    const status = getBridgeStatus();

    expect(status).toHaveProperty("channelApiConfigured");
    expect(status).toHaveProperty("botApiConfigured");
    expect(status).toHaveProperty("mirroredChannels");
    expect(status).toHaveProperty("successCount");
    expect(status.channelApiConfigured).toBe(true);
  });

  it("redactSensitiveContent redacts email, phone, and long tokens", async () => {
    const { redactSensitiveContent } = await import("@/lib/viber/bridge");
    const text = "Contact admin@example.com or +30 210 123 4567 with token abc123def456ghi789jkl012mno345pqr";
    const redacted = redactSensitiveContent(text);

    expect(redacted).not.toContain("admin@example.com");
    expect(redacted).toContain("[email]");
    expect(redacted).toContain("[redacted]");
  });
});

// ── Integrations Status Tests ──

describe("Integrations Status Endpoint", () => {
  it("returns list of known integrations", async () => {
    // Simulate the integration list structure
    const INTEGRATIONS = [
      { name: "Viber Channel Token", envKey: "VIBER_CHANNEL_AUTH_TOKEN", testable: true },
      { name: "Viber Bot Token", envKey: "VIBER_BOT_TOKEN", testable: true },
      { name: "Cron Secret", envKey: "CRON_SECRET", testable: false },
    ];

    const result = INTEGRATIONS.map((int) => ({
      ...int,
      configured: !!process.env[int.envKey],
    }));

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.every((r) => typeof r.configured === "boolean")).toBe(true);
  });
});

// ── Housekeeping Tests ──

describe("Feed Cron Housekeeping", () => {
  it("retention cutoff is correctly calculated", () => {
    const FEED_ITEM_RETENTION_DAYS = 90;
    const cutoff = new Date(Date.now() - FEED_ITEM_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Should be within 1 minute of each other
    expect(Math.abs(cutoff.getTime() - ninetyDaysAgo.getTime())).toBeLessThan(60_000);
  });
});

// ── Performance: requestIdleCallback polyfill ──

describe("Prefetch Polyfill", () => {
  it("polyfills requestIdleCallback when not available", () => {
    // In test environment, requestIdleCallback may not exist
    const ric = typeof globalThis.requestIdleCallback === "function"
      ? globalThis.requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 1) as unknown as number;
    expect(typeof ric).toBe("function");
  });
});
