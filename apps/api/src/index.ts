import {
  aiChatChunkSchema,
  aiChatRequestSchema,
  aiChatResponseSchema,
  aiProviderIdSchema,
  aiUsageResponseSchema,
  assistantDraftRequestSchema,
  assistantDraftResponseSchema,
  auditCreatedResponseSchema,
  auditEventInputSchema,
  auditEventSchema,
  healthResponseSchema,
  type AiProviderId,
  type AuditEvent,
} from "@internal-toolkit/shared";
import { z } from "zod";

type Env = {
  APP_VERSION?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_LEGACY_MUTATIONS?: string;
  FREE_ONLY_MODE?: string;
  AI_PROVIDER_MODE?: string;
  AI_ALLOW_PAID?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  COHERE_API_KEY?: string;
};

type RuntimeConfig = {
  appVersion: string;
  environment: "dev" | "prod";
  allowedOrigins: string[];
  allowLegacyMutations: boolean;
  freeOnlyMode: true;
  aiAllowPaid: false;
  aiProviders: AiProviderId[];
};

type UsageState = {
  requestsUsed: number;
  tokensUsed: number;
  windowDate: string;
};

type AuditRepository = {
  append: (event: AuditEvent) => AuditEvent;
};

type ShortcutRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  label: string;
  command: string;
  keybinding?: string;
  createdAt: string;
  updatedAt: string;
};

class InMemoryAuditRepository implements AuditRepository {
  #events: AuditEvent[] = [];

  append(event: AuditEvent) {
    this.#events.push(event);
    return event;
  }
}

const environmentSchema = z.enum(["dev", "prod"]);
const BOOLEAN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const DAILY_REQUEST_LIMIT = 20_000;
const DAILY_TOKEN_LIMIT = 5_000_000;
const usageByWindow = new Map<string, UsageState>();
const shortcutStore = new Map<string, ShortcutRecord[]>();
const auditRepository = new InMemoryAuditRepository();
let runtimeConfigCache: RuntimeConfig | null = null;

const createShortcutSchema = z.object({
  workspaceId: z.string().trim().min(1).default("default-workspace"),
  userId: z.string().trim().min(1).default("anonymous"),
  label: z.string().trim().min(1).max(60),
  command: z.string().trim().min(1).max(300),
  keybinding: z.string().trim().max(40).optional(),
});

const updateShortcutSchema = z.object({
  workspaceId: z.string().trim().min(1).default("default-workspace"),
  userId: z.string().trim().min(1).default("anonymous"),
  label: z.string().trim().min(1).max(60).optional(),
  command: z.string().trim().min(1).max(300).optional(),
  keybinding: z.string().trim().max(40).optional(),
});

function parseAllowedOrigins(rawOrigins: string | undefined) {
  const normalized =
    rawOrigins?.trim() || "http://127.0.0.1:3000,http://localhost:3000";

  if (normalized === "*") {
    throw new Error(
      "Invalid ALLOWED_ORIGINS: wildcard '*' is not allowed in production-grade mode.",
    );
  }

  const allowedOrigins = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error(
      "Invalid ALLOWED_ORIGINS: set at least one origin. See apps/api/.dev.vars.example.",
    );
  }

  for (const origin of allowedOrigins) {
    try {
      const parsed = new URL(origin);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Only http/https origins are supported.");
      }
    } catch (error) {
      throw new Error(
        `Invalid ALLOWED_ORIGINS entry "${origin}": ${error instanceof Error ? error.message : "malformed URL"}`,
      );
    }
  }

  return allowedOrigins;
}

function detectPaidTokens(env: Env) {
  return [
    env.OPENAI_API_KEY,
    env.ANTHROPIC_API_KEY,
    env.GOOGLE_API_KEY,
    env.COHERE_API_KEY,
  ].some((value) => Boolean(value?.trim()));
}

function getAiProviders(mode: string | undefined): AiProviderId[] {
  if (!mode || mode === "cloud_free") {
    return ["free-cloud-primary", "free-cloud-secondary", "mock-fallback"];
  }

  if (mode === "mock") {
    return ["mock-fallback"];
  }

  throw new Error('Invalid AI_PROVIDER_MODE: expected "cloud_free" or "mock".');
}

function getRuntimeConfig(env: Env): RuntimeConfig {
  if (runtimeConfigCache) {
    return runtimeConfigCache;
  }

  const parsedEnvironment = environmentSchema.safeParse(
    env.ENVIRONMENT?.trim() || "dev",
  );
  if (!parsedEnvironment.success) {
    throw new Error('Invalid ENVIRONMENT: expected "dev" or "prod".');
  }

  const parsedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const allowLegacyMutations = BOOLEAN_TRUE_VALUES.has(
    env.ALLOW_LEGACY_MUTATIONS?.trim().toLowerCase() || "",
  );
  const freeOnlyModeRaw = env.FREE_ONLY_MODE?.trim() || "1";
  const aiAllowPaidRaw = env.AI_ALLOW_PAID?.trim() || "0";
  const hasPaidTokens = detectPaidTokens(env);

  if (freeOnlyModeRaw !== "1") {
    throw new Error("FREE_ONLY_MODE must remain 1.");
  }

  if (aiAllowPaidRaw !== "0") {
    throw new Error("AI_ALLOW_PAID must remain 0 in free-only mode.");
  }

  if (hasPaidTokens) {
    throw new Error(
      "Paid provider API keys are not allowed in free-only mode. Remove paid provider keys from worker env.",
    );
  }

  const aiProviders = getAiProviders(env.AI_PROVIDER_MODE?.trim());
  aiProviders.forEach((provider) => aiProviderIdSchema.parse(provider));

  runtimeConfigCache = {
    appVersion: env.APP_VERSION?.trim() || "1.0.0",
    environment: parsedEnvironment.data,
    allowedOrigins: parsedOrigins,
    allowLegacyMutations,
    freeOnlyMode: true,
    aiAllowPaid: false,
    aiProviders,
  };

  return runtimeConfigCache;
}

function resolveCorsOrigin(request: Request, config: RuntimeConfig) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return null;
  }

  return config.allowedOrigins.includes(origin) ? origin : null;
}

function corsHeaders(request: Request, config: RuntimeConfig) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Expose-Headers": "X-Request-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  const allowedOrigin = resolveCorsOrigin(request, config);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  return headers;
}

function withSecurityHeaders(headers: Headers, request: Request) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(request.url).protocol === "https:") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
}

function getRequestId(request: Request) {
  const raw = request.headers.get("x-request-id")?.trim();
  return raw && raw.length > 0 ? raw : crypto.randomUUID();
}

function jsonResponse(
  request: Request,
  config: RuntimeConfig,
  requestId: string,
  body: unknown,
  status = 200,
) {
  const headers = corsHeaders(request, config);
  withSecurityHeaders(headers, request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Request-Id", requestId);
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function createMockDraft(prompt: string, environment: "dev" | "prod") {
  const normalizedPrompt = prompt.toLowerCase();
  const isDaily =
    normalizedPrompt.includes("daily") || normalizedPrompt.includes("every day");

  const triggerJson = isDaily
    ? { type: "schedule.cron", cron: "0 9 * * *", timezone: "UTC" }
    : { type: "record.created", tableId: "demo-table" };

  const actionsJson = [
    {
      type: "create_notification",
      title: "Automation draft generated",
      body: prompt,
    },
    {
      type: "write_audit_log",
      action: "assistant.draft.generated",
      environment,
    },
  ];

  return { triggerJson, actionsJson };
}

function getUsageState() {
  const windowDate = new Date().toISOString().slice(0, 10);
  const existing = usageByWindow.get(windowDate);

  if (existing) {
    return existing;
  }

  const state: UsageState = {
    requestsUsed: 0,
    tokensUsed: 0,
    windowDate,
  };
  usageByWindow.set(windowDate, state);
  return state;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function appendUsage(tokenCount: number) {
  const usage = getUsageState();
  usage.requestsUsed += 1;
  usage.tokensUsed += tokenCount;
  return usage;
}

function buildAiContent(prompt: string, task: string | undefined) {
  if (task === "automation_draft") {
    return JSON.stringify(
      {
        trigger: {
          type: "record.updated",
          table: "Incidents",
        },
        actions: [
          { type: "create_notification", title: "Incident updated" },
          { type: "write_audit_log", action: "automation.generated" },
        ],
        notes: prompt,
      },
      null,
      2,
    );
  }

  if (task === "kpi_layout") {
    return "KPI layout: top KPIs, middle trends and ownership load, bottom automations and recent incidents.";
  }

  return `Cloud-free response: ${prompt}`;
}

function chooseProvider(config: RuntimeConfig, prompt: string): AiProviderId {
  if (config.aiProviders.includes("free-cloud-primary")) {
    if (prompt.toLowerCase().includes("#secondary")) {
      return "free-cloud-secondary";
    }
    return "free-cloud-primary";
  }

  return "mock-fallback";
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function sseResponse(
  request: Request,
  config: RuntimeConfig,
  requestId: string,
  payload: {
    provider: AiProviderId;
    modelId: string;
    content: string;
  },
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const chunkSize = 48;
      for (let index = 0; index < payload.content.length; index += chunkSize) {
        const delta = payload.content.slice(index, index + chunkSize);
        const chunk = aiChatChunkSchema.parse({
          provider: payload.provider,
          requestId,
          delta,
          done: false,
          modelId: payload.modelId,
        });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        await delay(20);
      }

      const doneChunk = aiChatChunkSchema.parse({
        provider: payload.provider,
        requestId,
        delta: "",
        done: true,
        modelId: payload.modelId,
      });
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
      controller.close();
    },
  });

  const headers = corsHeaders(request, config);
  withSecurityHeaders(headers, request);
  headers.set("X-Request-Id", requestId);
  headers.set("Content-Type", "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Connection", "keep-alive");

  return new Response(stream, { status: 200, headers });
}

function guardFreeQuota() {
  const usage = getUsageState();
  return (
    usage.requestsUsed < DAILY_REQUEST_LIMIT && usage.tokensUsed < DAILY_TOKEN_LIMIT
  );
}

function getShortcutKey(workspaceId: string, userId: string) {
  return `${workspaceId}:${userId}`;
}

function listShortcuts(workspaceId: string, userId: string) {
  const key = getShortcutKey(workspaceId, userId);
  return shortcutStore.get(key) ?? [];
}

async function handleRequest(
  request: Request,
  config: RuntimeConfig,
  requestId: string,
) {
  const requestOrigin = request.headers.get("Origin");

  if (requestOrigin && !config.allowedOrigins.includes(requestOrigin)) {
    return jsonResponse(
      request,
      config,
      requestId,
      { ok: false, error: "Origin not allowed." },
      403,
    );
  }

  if (request.method === "OPTIONS") {
    const headers = corsHeaders(request, config);
    withSecurityHeaders(headers, request);
    headers.set("X-Request-Id", requestId);

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    const health = healthResponseSchema.parse({
      ok: true,
      version: config.appVersion,
      timestamp: new Date().toISOString(),
    });

    return jsonResponse(request, config, requestId, health);
  }

  if (request.method === "GET" && url.pathname === "/v1/ai/models") {
    return jsonResponse(request, config, requestId, {
      ok: true,
      mode: "free-only",
      defaultModelId: "cloud-free-default",
      providers: config.aiProviders,
      models: config.aiProviders.map((provider) => ({
        id: `${provider}:v1`,
        provider,
        freeOnly: true,
      })),
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/ai/usage") {
    const usage = getUsageState();
    const payload = aiUsageResponseSchema.parse({
      ok: true,
      mode: "free-only",
      providers: config.aiProviders,
      usage: {
        requestsUsed: usage.requestsUsed,
        requestsLimit: DAILY_REQUEST_LIMIT,
        tokensUsed: usage.tokensUsed,
        tokensLimit: DAILY_TOKEN_LIMIT,
      },
    });
    return jsonResponse(request, config, requestId, payload);
  }

  if (request.method === "GET" && url.pathname === "/v1/shortcuts") {
    const workspaceId =
      url.searchParams.get("workspaceId")?.trim() || "default-workspace";
    const userId = url.searchParams.get("userId")?.trim() || "anonymous";

    return jsonResponse(request, config, requestId, {
      ok: true,
      items: listShortcuts(workspaceId, userId),
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/shortcuts") {
    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Invalid JSON payload." },
        400,
      );
    }
    const parsed = createShortcutSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
        requestId,
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid shortcut payload.",
        },
        400,
      );
    }

    const nowIso = new Date().toISOString();
    const shortcut: ShortcutRecord = {
      id: crypto.randomUUID(),
      workspaceId: parsed.data.workspaceId,
      userId: parsed.data.userId,
      label: parsed.data.label,
      command: parsed.data.command,
      ...(parsed.data.keybinding ? { keybinding: parsed.data.keybinding } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const key = getShortcutKey(parsed.data.workspaceId, parsed.data.userId);
    const current = shortcutStore.get(key) ?? [];
    shortcutStore.set(key, [shortcut, ...current]);

    return jsonResponse(request, config, requestId, { ok: true, item: shortcut }, 201);
  }

  if (
    (request.method === "PATCH" || request.method === "DELETE") &&
    url.pathname.startsWith("/v1/shortcuts/")
  ) {
    const shortcutId = decodeURIComponent(
      url.pathname.replace("/v1/shortcuts/", ""),
    );
    const workspaceId =
      url.searchParams.get("workspaceId")?.trim() || "default-workspace";
    const userId = url.searchParams.get("userId")?.trim() || "anonymous";
    const key = getShortcutKey(workspaceId, userId);
    const current = shortcutStore.get(key) ?? [];
    const index = current.findIndex((item) => item.id === shortcutId);

    if (index < 0) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Shortcut not found." },
        404,
      );
    }

    if (request.method === "DELETE") {
      const next = [...current];
      next.splice(index, 1);
      shortcutStore.set(key, next);
      return jsonResponse(request, config, requestId, { ok: true });
    }

    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Invalid JSON payload." },
        400,
      );
    }
    const parsed = updateShortcutSchema.safeParse({
      workspaceId,
      userId,
      ...payload,
    });
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
        requestId,
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid shortcut payload.",
        },
        400,
      );
    }

    const next = [...current];
    const existing = next[index] as ShortcutRecord;
    const updated: ShortcutRecord = {
      ...existing,
      ...(parsed.data.label ? { label: parsed.data.label } : {}),
      ...(parsed.data.command ? { command: parsed.data.command } : {}),
      ...(parsed.data.keybinding ? { keybinding: parsed.data.keybinding } : {}),
      updatedAt: new Date().toISOString(),
    };
    next[index] = updated;
    shortcutStore.set(key, next);

    return jsonResponse(request, config, requestId, { ok: true, item: updated });
  }

  if (request.method === "POST" && url.pathname === "/v1/ai/chat") {
    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Invalid JSON payload." },
        400,
      );
    }

    const parsed = aiChatRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
        requestId,
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid AI chat request.",
        },
        400,
      );
    }

    if (!guardFreeQuota()) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Free AI quota reached. Try again later." },
        429,
      );
    }

    const startedAt = Date.now();
    const provider = chooseProvider(config, parsed.data.prompt);
    const modelId = parsed.data.modelId?.trim() || `${provider}:v1`;
    const content = buildAiContent(parsed.data.prompt, parsed.data.task);
    const tokenUsage = estimateTokens(`${parsed.data.prompt}\n${content}`);
    const usage = appendUsage(tokenUsage);
    const latencyMs = Date.now() - startedAt;

    if (parsed.data.stream || request.headers.get("accept")?.includes("text/event-stream")) {
      return sseResponse(request, config, requestId, {
        provider,
        modelId,
        content,
      });
    }

    const response = aiChatResponseSchema.parse({
      ok: true,
      provider,
      modelId,
      requestId,
      latencyMs,
      content,
      usage: {
        requestsUsed: usage.requestsUsed,
        requestsLimit: DAILY_REQUEST_LIMIT,
        tokensUsed: usage.tokensUsed,
        tokensLimit: DAILY_TOKEN_LIMIT,
      },
    });

    return jsonResponse(request, config, requestId, response);
  }

  if (request.method === "POST" && url.pathname === "/v1/audit") {
    if (!config.allowLegacyMutations) {
      const headers = corsHeaders(request, config);
      withSecurityHeaders(headers, request);
      headers.set("X-Request-Id", requestId);
      headers.set("Warning", '299 - "Legacy endpoint disabled. Use web canonical backend."');
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Legacy Worker mutation endpoint disabled. Set ALLOW_LEGACY_MUTATIONS=1 only for temporary compatibility. Deprecation deadline: 2026-06-30.",
        }),
        {
          status: 410,
          headers,
        },
      );
    }

    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Invalid JSON payload." },
        400,
      );
    }

    const parsed = auditEventInputSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
        requestId,
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid audit payload.",
        },
        400,
      );
    }

    const event = auditEventSchema.parse({
      ...parsed.data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

    const stored = auditRepository.append(event);
    const response = auditCreatedResponseSchema.parse({
      ok: true,
      id: stored.id,
    });

    return jsonResponse(request, config, requestId, response, 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/assistant/draft-automation") {
    if (!config.allowLegacyMutations) {
      const headers = corsHeaders(request, config);
      withSecurityHeaders(headers, request);
      headers.set("X-Request-Id", requestId);
      headers.set("Warning", '299 - "Legacy endpoint disabled. Use web canonical backend."');
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Legacy Worker mutation endpoint disabled. Set ALLOW_LEGACY_MUTATIONS=1 only for temporary compatibility. Deprecation deadline: 2026-06-30.",
        }),
        {
          status: 410,
          headers,
        },
      );
    }

    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(
        request,
        config,
        requestId,
        { ok: false, error: "Invalid JSON payload." },
        400,
      );
    }

    const parsed = assistantDraftRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
        requestId,
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid draft request.",
        },
        400,
      );
    }

    const draft = createMockDraft(parsed.data.prompt, config.environment);
    const response = assistantDraftResponseSchema.parse({
      ok: true,
      triggerJson: draft.triggerJson,
      actionsJson: draft.actionsJson,
    });

    return jsonResponse(request, config, requestId, response);
  }

  return jsonResponse(request, config, requestId, { ok: false, error: "Not Found" }, 404);
}

export default {
  async fetch(request, env) {
    const requestId = getRequestId(request);
    const startedAt = Date.now();
    const pathname = new URL(request.url).pathname;

    let response: Response | null = null;
    try {
      const config = getRuntimeConfig(env as Env);
      response = await handleRequest(request, config, requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const headers = new Headers({
        "Content-Type": "application/json; charset=utf-8",
        "X-Request-Id": requestId,
      });
      withSecurityHeaders(headers, request);
      response = new Response(JSON.stringify({ ok: false, error: message }), {
        status: 500,
        headers,
      });
    } finally {
      const durationMs = Date.now() - startedAt;
      const status = response?.status ?? 500;
      console.info(
        JSON.stringify({
          event: "api.request",
          requestId,
          method: request.method,
          path: pathname,
          status,
          durationMs,
        }),
      );
    }

    return response ?? new Response("Unexpected runtime error", { status: 500 });
  },
} satisfies ExportedHandler<Env>;
