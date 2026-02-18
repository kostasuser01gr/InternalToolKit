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
  allowAnyOrigin: boolean;
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
    return {
      allowAnyOrigin: true,
      allowedOrigins: ["*"],
    };
  }

  const allowedOrigins = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error(
      "Invalid ALLOWED_ORIGINS: set at least one origin (or '*'). See apps/api/.dev.vars.example.",
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

  return {
    allowAnyOrigin: false,
    allowedOrigins,
  };
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
    allowedOrigins: parsedOrigins.allowedOrigins,
    allowAnyOrigin: parsedOrigins.allowAnyOrigin,
    openAiApiKey: env.OPENAI_API_KEY?.trim() || "",
  };

  return runtimeConfigCache;
}

function resolveCorsOrigin(request: Request, config: RuntimeConfig) {
  if (config.allowAnyOrigin) {
    return "*";
  }

  const origin = request.headers.get("Origin");

  if (!origin) {
    return null;
  }

  return config.allowedOrigins.includes(origin) ? origin : null;
}

function corsHeaders(request: Request, config: RuntimeConfig) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  });
  const allowedOrigin = resolveCorsOrigin(request, config);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (!config.allowAnyOrigin) {
    headers.set("Vary", "Origin");
  }

  return headers;
}

function jsonResponse(
  request: Request,
  config: RuntimeConfig,
  body: unknown,
  status = 200,
) {
  const headers = corsHeaders(request, config);
  headers.set("Content-Type", "application/json; charset=utf-8");

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

async function handleRequest(request: Request, env: Env) {
  const config = getRuntimeConfig(env);
  const requestOrigin = request.headers.get("Origin");

  if (
    requestOrigin &&
    !config.allowAnyOrigin &&
    !config.allowedOrigins.includes(requestOrigin)
  ) {
    return new Response(JSON.stringify({ ok: false, error: "Origin not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8", Vary: "Origin" },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, config),
    });
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    const health = healthResponseSchema.parse({
      ok: true,
      version: config.appVersion,
      timestamp: new Date().toISOString(),
    });

    return jsonResponse(request, config, health);
  }

  if (request.method === "POST" && url.pathname === "/v1/audit") {
    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(request, config, { ok: false, error: "Invalid JSON payload." }, 400);
    }

    const parsed = auditEventInputSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
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

    return jsonResponse(request, config, response, 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/assistant/draft-automation") {
    const payload = await parseJson(request);
    if (!payload) {
      return jsonResponse(request, config, { ok: false, error: "Invalid JSON payload." }, 400);
    }

    const parsed = assistantDraftRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse(
        request,
        config,
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

    return jsonResponse(request, config, response);
  }

  return jsonResponse(request, config, { ok: false, error: "Not Found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env as Env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  },
} satisfies ExportedHandler<Env>;
