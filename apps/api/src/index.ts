import {
  assistantDraftRequestSchema,
  assistantDraftResponseSchema,
  auditEventInputSchema,
  auditEventSchema,
  demoUserSchema,
  healthResponseSchema,
  type AuditEvent,
  type AutomationDraft,
} from "@internal-toolkit/shared";

type Env = {
  APP_VERSION?: string;
  CORS_ORIGIN?: string;
};

type RuntimeConfig = {
  appVersion: string;
  allowedOrigins: string[];
  allowAnyOrigin: boolean;
};

type AuditRepository = {
  append: (event: AuditEvent) => AuditEvent;
  list: () => AuditEvent[];
};

class InMemoryAuditRepository implements AuditRepository {
  #events: AuditEvent[] = [];

  append(event: AuditEvent) {
    this.#events.push(event);
    return event;
  }

  list() {
    return [...this.#events];
  }
}

const auditRepository = new InMemoryAuditRepository();

let runtimeConfigCache: RuntimeConfig | null = null;

function parseAllowedOrigins(rawOrigins: string | undefined) {
  const configured = rawOrigins?.trim();

  if (!configured || configured === "*") {
    return {
      allowAnyOrigin: true,
      allowedOrigins: ["*"],
    };
  }

  const allowedOrigins = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error(
      "Invalid CORS_ORIGIN: at least one origin is required. See apps/api/.dev.vars.example.",
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
        `Invalid CORS_ORIGIN entry "${origin}": ${error instanceof Error ? error.message : "malformed URL"}`,
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

  const appVersion = env.APP_VERSION?.trim() || "1.0.0";

  if (!appVersion) {
    throw new Error(
      "Invalid APP_VERSION: value must be a non-empty string. See apps/api/.dev.vars.example.",
    );
  }

  const parsedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);

  runtimeConfigCache = {
    appVersion,
    allowedOrigins: parsedOrigins.allowedOrigins,
    allowAnyOrigin: parsedOrigins.allowAnyOrigin,
  };

  return runtimeConfigCache;
}

function getAllowedOrigin(request: Request, config: RuntimeConfig) {
  const origin = request.headers.get("Origin");

  if (config.allowAnyOrigin) {
    return "*";
  }

  if (!origin) {
    return config.allowedOrigins[0] ?? "*";
  }

  return config.allowedOrigins.includes(origin)
    ? origin
    : (config.allowedOrigins[0] ?? "*");
}

function corsHeaders(request: Request, config: RuntimeConfig) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(request, config),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  config: RuntimeConfig,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, config),
      ...extraHeaders,
    },
  });
}

async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function createDraftFromPrompt(prompt: string): AutomationDraft {
  const normalized = prompt.toLowerCase();
  const scheduleDaily = normalized.includes("daily") || normalized.includes("every day");
  const updateRecord = normalized.includes("update") || normalized.includes("status");

  return {
    name: "Draft from Assistant",
    trigger: {
      type: scheduleDaily ? "schedule.cron" : "record.created",
      config: scheduleDaily
        ? { cron: "0 9 * * *", timezone: "UTC" }
        : { tableId: "demo-table" },
    },
    actions: [
      {
        type: "create_notification",
        config: {
          title: "Automation draft generated",
          body: prompt,
        },
      },
      {
        type: updateRecord ? "update_record" : "write_audit_log",
        config: updateRecord
          ? { tableId: "demo-table", field: "status", value: "processed" }
          : { action: "assistant.draft.generated" },
      },
    ],
    rationale:
      "This draft maps plain-English intent into a trigger/action structure and is safe to edit before activation.",
  };
}

async function handleRequest(request: Request, env: Env) {
  const config = getRuntimeConfig(env);

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

  if (request.method === "GET" && url.pathname === "/v1/me") {
    const role = request.headers.get("Authorization")?.toLowerCase().includes("admin")
      ? "ADMIN"
      : "EDITOR";

    const user = demoUserSchema.parse({
      id: "demo-user-1",
      email: "demo@internaltoolkit.local",
      name: "Demo Operator",
      role,
    });

    return jsonResponse(request, config, { ok: true, user });
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

    auditRepository.append(event);

    return jsonResponse(request, config, {
      ok: true,
      event,
      total: auditRepository.list().length,
    });
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

    const response = assistantDraftResponseSchema.parse({
      ok: true,
      draft: createDraftFromPrompt(parsed.data.prompt),
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
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
