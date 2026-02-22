/**
 * Viber Bridge — One-way mirror from #washers-only to Viber group/community
 *
 * Feature flag: FEATURE_VIBER_BRIDGE=1
 * Required env: VIBER_BOT_TOKEN, VIBER_TARGET_GROUP_ID
 * Optional: VIBER_WEBHOOK_SECRET (for inbound two-way)
 *
 * Architecture:
 * - Default: one-way internal → Viber (safe, reliable)
 * - Optional: two-way with graceful fallback to one-way
 * - Rate-limited per channel
 * - Dead-letter queue for failed deliveries
 * - PII redaction before forwarding
 */

const VIBER_API_URL = "https://chatapi.viber.com/pa/send_message";

export type ViberBridgeConfig = {
  enabled: boolean;
  botToken: string;
  targetGroupId: string;
  webhookSecret: string;
  mode: "one-way" | "two-way";
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

export function getViberBridgeConfig(): ViberBridgeConfig {
  const enabled = process.env.FEATURE_VIBER_BRIDGE === "1";
  return {
    enabled,
    botToken: process.env.VIBER_BOT_TOKEN ?? "",
    targetGroupId: process.env.VIBER_TARGET_GROUP_ID ?? "",
    webhookSecret: process.env.VIBER_WEBHOOK_SECRET ?? "",
    mode: process.env.VIBER_BRIDGE_MODE === "two-way" ? "two-way" : "one-way",
  };
}

export function isViberBridgeReady(): boolean {
  const config = getViberBridgeConfig();
  return config.enabled && config.botToken.length > 0 && config.targetGroupId.length > 0;
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

/** Send a message to Viber group via Bot API */
async function sendToViber(config: ViberBridgeConfig, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(VIBER_API_URL, {
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

  if (!config.botToken || !config.targetGroupId) {
    return { success: false, error: "Missing VIBER_BOT_TOKEN or VIBER_TARGET_GROUP_ID" };
  }

  // Only bridge #washers-only
  if (message.channelSlug !== "washers-only") {
    return { success: false, error: "Bridge only supports #washers-only channel" };
  }

  if (!checkBridgeRateLimit(message.channelSlug)) {
    addToDeadLetter(message, "Rate limit exceeded");
    return { success: false, error: "Rate limit exceeded" };
  }

  const redacted = redactSensitiveContent(message.content);
  const formatted = `[${message.authorName}] ${redacted}`;

  const result = await sendToViber(config, formatted);

  if (!result.ok) {
    addToDeadLetter(message, result.error ?? "Unknown");
    return { success: false, error: result.error };
  }

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
  deadLetterCount: number;
  recentFailures: DeadLetterEntry[];
} {
  const config = getViberBridgeConfig();
  return {
    enabled: config.enabled,
    ready: isViberBridgeReady(),
    mode: config.mode,
    deadLetterCount: deadLetterQueue.length,
    recentFailures: deadLetterQueue.slice(-5),
  };
}
