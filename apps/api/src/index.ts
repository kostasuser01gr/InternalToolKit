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

function getAllowedOrigin(request: Request, env: Env) {
  const configured = env.CORS_ORIGIN?.trim();
  const origin = request.headers.get("Origin");

  if (!configured || configured === "*") {
    return "*";
  }

  if (!origin) {
    return configured;
  }

  const allowedOrigins = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? configured;
}

function corsHeaders(request: Request, env: Env) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(request, env),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  env: Env,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
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
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, env),
    });
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    const health = healthResponseSchema.parse({
      ok: true,
      version: env.APP_VERSION ?? "1.0.0",
      timestamp: new Date().toISOString(),
    });

    return jsonResponse(request, env, health);
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

    return jsonResponse(request, env, { ok: true, user });
  }

  if (request.method === "POST" && url.pathname === "/v1/audit") {
    const payload = await parseJson(request);

    if (!payload) {
      return jsonResponse(request, env, { ok: false, error: "Invalid JSON payload." }, 400);
    }

    const parsed = auditEventInputSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonResponse(
        request,
        env,
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

    return jsonResponse(request, env, {
      ok: true,
      event,
      total: auditRepository.list().length,
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/assistant/draft-automation") {
    const payload = await parseJson(request);

    if (!payload) {
      return jsonResponse(request, env, { ok: false, error: "Invalid JSON payload." }, 400);
    }

    const parsed = assistantDraftRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonResponse(
        request,
        env,
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

    return jsonResponse(request, env, response);
  }

  return jsonResponse(request, env, { ok: false, error: "Not Found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env as Env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return jsonResponse(request, env as Env, { ok: false, error: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
