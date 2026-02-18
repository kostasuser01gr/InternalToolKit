import {
  assistantDraftRequestSchema,
  assistantDraftResponseSchema,
  auditCreatedResponseSchema,
  auditEventInputSchema,
  auditEventSchema,
  healthResponseSchema,
  type AuditEvent,
} from "@internal-toolkit/shared";
import { z } from "zod";

type Env = {
  APP_VERSION?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  OPENAI_API_KEY?: string;
};

type RuntimeConfig = {
  appVersion: string;
  environment: "dev" | "prod";
  allowedOrigins: string[];
  openAiApiKey: string;
};

type AuditRepository = {
  append: (event: AuditEvent) => AuditEvent;
};

class InMemoryAuditRepository implements AuditRepository {
  #events: AuditEvent[] = [];

  append(event: AuditEvent) {
    this.#events.push(event);
    return event;
  }
}

const environmentSchema = z.enum(["dev", "prod"]);
const auditRepository = new InMemoryAuditRepository();
let runtimeConfigCache: RuntimeConfig | null = null;

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

  runtimeConfigCache = {
    appVersion: env.APP_VERSION?.trim() || "1.0.0",
    environment: parsedEnvironment.data,
    allowedOrigins: parsedOrigins,
    openAiApiKey: env.OPENAI_API_KEY?.trim() || "",
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
  const isDaily = normalizedPrompt.includes("daily") || normalizedPrompt.includes("every day");

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

async function handleRequest(request: Request, config: RuntimeConfig, requestId: string) {
  const requestOrigin = request.headers.get("Origin");

  if (
    requestOrigin &&
    !config.allowedOrigins.includes(requestOrigin)
  ) {
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

  if (request.method === "POST" && url.pathname === "/v1/audit") {
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

    // Mock adapter by default; OPENAI_API_KEY is reserved for a future provider implementation.
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
