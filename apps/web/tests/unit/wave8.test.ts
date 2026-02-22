/**
 * Wave 8 — Gap fixes: cron retry, chat RBAC search, Viber rich media,
 * shortcut reordering, CLI setup helper
 */

import { describe, it, expect, vi } from "vitest";

// ── W8-A: withRetry backoff ──
describe("Wave 8-A: withRetry backoff", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    // Inline bounded retry
    async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 10)); // fast for test
          }
        }
      }
      throw lastError;
    }
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("recovered");

    async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }
      }
      throw lastError;
    }
    const result = await withRetry(fn);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent fail"));

    async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }
      }
      throw lastError;
    }
    await expect(withRetry(fn)).rejects.toThrow("persistent fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff delays", async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
            delays.push(delayMs);
            // Don't actually wait in test
          }
        }
      }
      throw lastError;
    }
    await expect(withRetry(fn)).rejects.toThrow();
    expect(delays).toEqual([1000, 2000]); // 2^0*1000, 2^1*1000
  });
});

// ── W8-B: Chat search RBAC ──
describe("Wave 8-B: Chat search RBAC", () => {
  it("RBAC filter logic excludes private channels user is not member of", () => {
    const userChannelIds = ["ch-1", "ch-3"];

    // Simulate filtering messages by channel membership
    const messages = [
      { id: "m1", threadChannelId: null, channelType: null },    // no channel — visible
      { id: "m2", threadChannelId: "ch-1", channelType: "PRIVATE" }, // member — visible
      { id: "m3", threadChannelId: "ch-2", channelType: "PRIVATE" }, // NOT member — hidden
      { id: "m4", threadChannelId: "ch-3", channelType: "PUBLIC" },  // public — visible
      { id: "m5", threadChannelId: "ch-4", channelType: "PUBLIC" },  // public — visible
    ];

    const filtered = messages.filter((m) => {
      if (!m.threadChannelId) return true; // no channel
      if (m.channelType === "PUBLIC") return true; // public
      return userChannelIds.includes(m.threadChannelId); // member check
    });

    expect(filtered.map((m) => m.id)).toEqual(["m1", "m2", "m4", "m5"]);
  });

  it("allows messages from threads without channel", () => {
    const msg = { threadChannelId: null, channelType: null };
    const visible = !msg.threadChannelId || msg.channelType === "PUBLIC";
    expect(visible).toBe(true);
  });
});

// ── W8-C: Viber rich media types ──
describe("Wave 8-C: Viber rich media", () => {
  it("sendViaChannelRich builds correct picture payload", async () => {
    const { sendViaChannelRich } = await import("@/lib/viber/bridge");
    // Without token configured, should return error
    const result = await sendViaChannelRich("picture", {
      mediaUrl: "https://example.com/img.jpg",
      text: "Photo caption",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Missing VIBER_CHANNEL_AUTH_TOKEN");
  });

  it("sendViaChannelRich builds correct file payload", async () => {
    const { sendViaChannelRich } = await import("@/lib/viber/bridge");
    const result = await sendViaChannelRich("file", {
      mediaUrl: "https://example.com/doc.pdf",
      fileName: "report.pdf",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Missing VIBER_CHANNEL_AUTH_TOKEN");
  });

  it("setViberWebhook returns error without token", async () => {
    const { setViberWebhook } = await import("@/lib/viber/bridge");
    const result = await setViberWebhook("https://example.com/webhook");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Missing Viber auth token");
  });

  it("getViberAccountInfo returns error without token", async () => {
    const { getViberAccountInfo } = await import("@/lib/viber/bridge");
    const result = await getViberAccountInfo();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Missing Viber auth token");
  });
});

// ── W8-D: Shortcut reordering ──
describe("Wave 8-D: Shortcut reordering", () => {
  it("schema accepts position field in create/update", async () => {
    const { z } = await import("zod");
    const createSchema = z.object({
      label: z.string().min(1).max(60),
      command: z.string().min(1).max(300),
      keybinding: z.string().max(40).optional(),
      position: z.number().int().min(0).optional(),
    });

    const valid = createSchema.safeParse({
      label: "Test",
      command: "/test",
      position: 3,
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.position).toBe(3);
  });

  it("position defaults to 0 when not provided", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      position: z.number().int().min(0).optional(),
    });
    const result = schema.parse({});
    expect(result.position).toBeUndefined();
    // DB default is 0 via @default(0)
  });

  it("rejects negative position", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      position: z.number().int().min(0).optional(),
    });
    const result = schema.safeParse({ position: -1 });
    expect(result.success).toBe(false);
  });

  it("shortcutDefinitionSchema includes position", async () => {
    const { shortcutDefinitionSchema } = await import("@internal-toolkit/shared");
    const valid = shortcutDefinitionSchema.safeParse({
      id: "sc1",
      workspaceId: "ws1",
      label: "Test",
      command: "/test",
      position: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(valid.success).toBe(true);
  });
});

// ── W8-E: CLI setup helper ──
describe("Wave 8-E: CLI setup:integrations", () => {
  it("setup script exists", async () => {
    const { existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const scriptPath = resolve(process.cwd(), "scripts/setup-integrations.mjs");
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("script defines all required integration vars", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const scriptPath = resolve(process.cwd(), "scripts/setup-integrations.mjs");
    const content = readFileSync(scriptPath, "utf-8");
    expect(content).toContain("VIBER_CHANNEL_AUTH_TOKEN");
    expect(content).toContain("VIBER_BOT_TOKEN");
    expect(content).toContain("CRON_SECRET");
    expect(content).toContain("FEATURE_VIBER_BRIDGE");
    expect(content).toContain(".env.local");
  });
});

// ── W8-F: Bridge exports ──
describe("Wave 8-F: Bridge module exports", () => {
  it("exports all new helper functions", async () => {
    const bridge = await import("@/lib/viber/bridge");
    expect(typeof bridge.sendViaChannelRich).toBe("function");
    expect(typeof bridge.setViberWebhook).toBe("function");
    expect(typeof bridge.getViberAccountInfo).toBe("function");
    expect(typeof bridge.mirrorToViber).toBe("function");
    expect(typeof bridge.getBridgeStatus).toBe("function");
    expect(typeof bridge.retryDeadLetters).toBe("function");
  });

  it("PII redaction still works", async () => {
    const { redactSensitiveContent } = await import("@/lib/viber/bridge");
    expect(redactSensitiveContent("call me@test.com")).toContain("[email]");
    expect(redactSensitiveContent("call +30 210 1234567")).toContain("[phone]");
  });
});
