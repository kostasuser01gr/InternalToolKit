/**
 * Viber Bridge — Mirror internal channels to Viber Channel/Group
 *
 * Feature flag: FEATURE_VIBER_BRIDGE=1
 * Required env: VIBER_BOT_TOKEN, VIBER_TARGET_GROUP_ID
 * Optional: VIBER_CHANNEL_AUTH_TOKEN (Channel Post API)
 *            VIBER_WEBHOOK_SECRET (for inbound two-way)
 *
 * Architecture:
 * - Primary: Channel Post API for public announcements (preferred)
 * - Fallback: Bot send_message API for group delivery
 * - Rate-limited per channel
 * - Dead-letter queue for failed deliveries
 * - PII redaction before forwarding
 * - Multi-channel: mirror #washers-only + optionally #ops-general
 */

const VIBER_BOT_API_URL = "https://chatapi.viber.com/pa/send_message";
const VIBER_CHANNEL_POST_URL = "https://chatapi.viber.com/pa/post";

export type ViberBridgeConfig = {
  enabled: boolean;
  botToken: string;
  targetGroupId: string;
  channelToken: string;
  webhookSecret: string;
  mode: "one-way" | "two-way";
  mirroredChannels: string[];
};

export type BridgeMessage = {
  id: string;
  channelSlug: string;
  content: string;
  authorName: string;
  timestamp: Date;
};

export type DeadLetterEntry = {
  message: BridgeMessage;
  error: string;
  attempts: number;
  lastAttempt: Date;
};

// In-memory rate limiter + dead-letter queue
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const deadLetterQueue: DeadLetterEntry[] = [];
const MAX_DEAD_LETTERS = 100;
const RATE_LIMIT = 20; // messages per minute
const RATE_WINDOW_MS = 60_000;

// Admin status tracking
let lastSuccessAt: Date | null = null;
let lastSuccessItem: string | null = null;
let successCount = 0;

export function getViberBridgeConfig(): ViberBridgeConfig {
  const enabled = process.env.FEATURE_VIBER_BRIDGE === "1";
  const mirroredRaw = process.env.VIBER_MIRRORED_CHANNELS ?? "washers-only";
  return {
    enabled,
    botToken: process.env.VIBER_BOT_TOKEN ?? "",
    targetGroupId: process.env.VIBER_TARGET_GROUP_ID ?? "",
    channelToken: process.env.VIBER_CHANNEL_AUTH_TOKEN ?? "",
    webhookSecret: process.env.VIBER_WEBHOOK_SECRET ?? "",
    mode: process.env.VIBER_BRIDGE_MODE === "two-way" ? "two-way" : "one-way",
    mirroredChannels: mirroredRaw.split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export function isViberBridgeReady(): boolean {
  const config = getViberBridgeConfig();
  return config.enabled && (config.channelToken.length > 0 || (config.botToken.length > 0 && config.targetGroupId.length > 0));
}

/** Redact potentially sensitive patterns before forwarding */
export function redactSensitiveContent(content: string): string {
  let redacted = content;
  // Redact email addresses
  redacted = redacted.replace(/[\w.+-]+@[\w.-]+\.[\w]{2,}/g, "[email]");
  // Redact phone numbers (basic patterns)
  redacted = redacted.replace(/(\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4})/g, "[phone]");
  // Redact potential API keys / tokens (long alphanumeric strings)
  redacted = redacted.replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
  return redacted;
}

function checkBridgeRateLimit(channelSlug: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(channelSlug);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(channelSlug, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT) {
    return false;
  }

  bucket.count++;
  return true;
}

/** Send via Viber Channel Post API (preferred for public announcements) */
async function sendViaChannel(config: ViberBridgeConfig, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(VIBER_CHANNEL_POST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Viber-Auth-Token": config.channelToken,
      },
      body: JSON.stringify({
        type: "text",
        text,
        sender: { name: "OPS Bridge" },
      }),
    });
    if (!res.ok) return { ok: false, error: `Channel HTTP ${res.status}` };
    const data = await res.json();
    if (data.status !== 0) return { ok: false, error: `Channel error ${data.status}: ${data.status_message}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown channel error" };
  }
}

/** Send a message to Viber group via Bot API (fallback) */
async function sendToViber(config: ViberBridgeConfig, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(VIBER_BOT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Viber-Auth-Token": config.botToken,
      },
      body: JSON.stringify({
        receiver: config.targetGroupId,
        type: "text",
        text,
        sender: {
          name: "OPS Bridge",
        },
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.status !== 0) {
      return { ok: false, error: `Viber error ${data.status}: ${data.status_message}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Mirror a message from internal channel to Viber */
export async function mirrorToViber(message: BridgeMessage): Promise<{ success: boolean; error?: string | undefined }> {
  const config = getViberBridgeConfig();

  if (!config.enabled) {
    return { success: false, error: "Bridge disabled" };
  }

  // Check if this channel is configured for mirroring
  if (!config.mirroredChannels.includes(message.channelSlug)) {
    return { success: false, error: `Channel #${message.channelSlug} not in mirrored list` };
  }

  if (!config.channelToken && !config.botToken) {
    return { success: false, error: "Missing VIBER_CHANNEL_AUTH_TOKEN and VIBER_BOT_TOKEN" };
  }

  if (!checkBridgeRateLimit(message.channelSlug)) {
    addToDeadLetter(message, "Rate limit exceeded");
    return { success: false, error: "Rate limit exceeded" };
  }

  const redacted = redactSensitiveContent(message.content);
  const formatted = `[#${message.channelSlug}] ${message.authorName}: ${redacted}`;

  // Prefer Channel Post API, fallback to Bot API
  let result: { ok: boolean; error?: string };
  if (config.channelToken) {
    result = await sendViaChannel(config, formatted);
    // Fallback to bot API if channel post fails
    if (!result.ok && config.botToken && config.targetGroupId) {
      result = await sendToViber(config, formatted);
    }
  } else {
    if (!config.targetGroupId) {
      return { success: false, error: "Missing VIBER_TARGET_GROUP_ID for Bot API" };
    }
    result = await sendToViber(config, formatted);
  }

  if (!result.ok) {
    addToDeadLetter(message, result.error ?? "Unknown");
    return { success: false, error: result.error };
  }

  // Track success for admin status
  lastSuccessAt = new Date();
  lastSuccessItem = message.content.slice(0, 100);
  successCount++;

  return { success: true };
}

function addToDeadLetter(message: BridgeMessage, error: string) {
  // Check if already in queue
  const existing = deadLetterQueue.find((e) => e.message.id === message.id);
  if (existing) {
    existing.attempts++;
    existing.lastAttempt = new Date();
    existing.error = error;
    return;
  }

  if (deadLetterQueue.length >= MAX_DEAD_LETTERS) {
    deadLetterQueue.shift(); // remove oldest
  }

  deadLetterQueue.push({
    message,
    error,
    attempts: 1,
    lastAttempt: new Date(),
  });
}

/** Retry failed deliveries */
export async function retryDeadLetters(): Promise<{ retried: number; succeeded: number }> {
  let retried = 0;
  let succeeded = 0;

  const toRetry = [...deadLetterQueue].filter((e) => e.attempts < 5);

  for (const entry of toRetry) {
    retried++;
    const result = await mirrorToViber(entry.message);
    if (result.success) {
      succeeded++;
      const idx = deadLetterQueue.indexOf(entry);
      if (idx >= 0) deadLetterQueue.splice(idx, 1);
    }
  }

  return { retried, succeeded };
}

/** Get bridge status for admin view */
export function getBridgeStatus(): {
  enabled: boolean;
  ready: boolean;
  mode: string;
  mirroredChannels: string[];
  channelApiConfigured: boolean;
  botApiConfigured: boolean;
  deadLetterCount: number;
  recentFailures: DeadLetterEntry[];
  lastSuccessAt: Date | null;
  lastSuccessItem: string | null;
  successCount: number;
} {
  const config = getViberBridgeConfig();
  return {
    enabled: config.enabled,
    ready: isViberBridgeReady(),
    mode: config.mode,
    mirroredChannels: config.mirroredChannels,
    channelApiConfigured: config.channelToken.length > 0,
    botApiConfigured: config.botToken.length > 0 && config.targetGroupId.length > 0,
    deadLetterCount: deadLetterQueue.length,
    recentFailures: deadLetterQueue.slice(-5),
    lastSuccessAt,
    lastSuccessItem,
    successCount,
  };
}
