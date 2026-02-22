/**
 * Multi-model AI router with automatic task-based routing,
 * fallback chains, circuit breaker, and PII redaction.
 *
 * Free models only (via OpenRouter-compatible endpoints):
 *  - qwen/qwen3-coder:free
 *  - meta-llama/llama-3.3-70b-instruct:free
 *  - openai/gpt-oss-120b:free
 *  - arcee-ai/trinity-large-preview:free
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskClass = "coding" | "general" | "summary";
export type RouterMode = "fast" | "best";

export interface FreeModel {
  id: string;
  /** Which task classes this model is best suited for */
  strengths: TaskClass[];
  /** Relative priority within a task class (lower = preferred) */
  priority: number;
}

export interface RouterTelemetry {
  modelUsed: string;
  latencyMs: number;
  success: boolean;
  fallbackChain: string[];
  taskClass: TaskClass;
}

export interface RouterResult {
  content: string;
  telemetry: RouterTelemetry;
}

// ---------------------------------------------------------------------------
// Free model registry (de-duplicated, configurable)
// ---------------------------------------------------------------------------

export const FREE_MODELS: FreeModel[] = [
  {
    id: "qwen/qwen3-coder:free",
    strengths: ["coding", "general"],
    priority: 1,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    strengths: ["general", "summary"],
    priority: 1,
  },
  {
    id: "openai/gpt-oss-120b:free",
    strengths: ["general", "coding", "summary"],
    priority: 2,
  },
  {
    id: "arcee-ai/trinity-large-preview:free",
    strengths: ["summary", "general"],
    priority: 2,
  },
];

// ---------------------------------------------------------------------------
// Task classifier
// ---------------------------------------------------------------------------

const CODE_SIGNALS =
  /\b(code|function|bug|error|regex|sql|script|api|endpoint|debug|refactor|json|schema|prisma|typescript|javascript|python|css|html)\b/i;

const SUMMARY_SIGNALS =
  /\b(summarize|summary|overview|recap|digest|report|brief|tldr|highlights|key points)\b/i;

export function classifyTask(prompt: string): TaskClass {
  if (CODE_SIGNALS.test(prompt)) return "coding";
  if (SUMMARY_SIGNALS.test(prompt)) return "summary";
  return "general";
}

// ---------------------------------------------------------------------------
// PII / secret redaction
// ---------------------------------------------------------------------------

const PII_PATTERNS: { re: RegExp; replacement: string }[] = [
  // API keys / tokens (long hex/base64 strings — must be before phone)
  {
    re: /\b(?:sk-|pk-|ghp_|gho_|xox[bpsa]-|Bearer\s+)[A-Za-z0-9_\-/.=]{20,}\b/g,
    replacement: "[REDACTED_KEY]",
  },
  // Connection strings
  {
    re: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/gi,
    replacement: "[REDACTED_CONN_STRING]",
  },
  // Email
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[EMAIL]" },
  // Phone numbers (require leading + or common separators)
  { re: /\+\d[\d\s\-().]{7,}\d/g, replacement: "[PHONE]" },
  // Generic long secrets (40+ alphanumeric)
  { re: /\b[A-Za-z0-9/+=]{40,}\b/g, replacement: "[REDACTED_SECRET]" },
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const { re, replacement } of PII_PATTERNS) {
    result = result.replace(re, replacement);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Circuit breaker (per-model)
// ---------------------------------------------------------------------------

interface CircuitState {
  failures: number;
  lastFailure: number;
  openUntil: number;
}

const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// In-memory store (resets on cold start which is fine for serverless)
const circuits = new Map<string, CircuitState>();

export function isCircuitOpen(modelId: string): boolean {
  const state = circuits.get(modelId);
  if (!state) return false;
  if (Date.now() < state.openUntil) return true;
  // Reset after cooldown
  if (state.openUntil > 0 && Date.now() >= state.openUntil) {
    circuits.delete(modelId);
    return false;
  }
  return false;
}

export function recordSuccess(modelId: string): void {
  circuits.delete(modelId);
}

export function recordFailure(modelId: string): void {
  const now = Date.now();
  const state = circuits.get(modelId) ?? {
    failures: 0,
    lastFailure: 0,
    openUntil: 0,
  };

  // Reset failure count if outside window
  if (now - state.lastFailure > CIRCUIT_WINDOW_MS) {
    state.failures = 0;
  }

  state.failures += 1;
  state.lastFailure = now;

  if (state.failures >= CIRCUIT_FAIL_THRESHOLD) {
    state.openUntil = now + CIRCUIT_COOLDOWN_MS;
  }

  circuits.set(modelId, state);
}

/** Visible for testing */
export function resetCircuits(): void {
  circuits.clear();
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

export function selectModels(
  taskClass: TaskClass,
  mode: RouterMode,
): string[] {
  const candidates = FREE_MODELS.filter(
    (m) => m.strengths.includes(taskClass) && !isCircuitOpen(m.id),
  );

  // Sort: lower priority number = preferred
  candidates.sort((a, b) => a.priority - b.priority);

  if (mode === "fast") {
    // Prefer fastest (first available)
    return candidates.slice(0, 3).map((m) => m.id);
  }

  // "best" mode: prefer higher-parameter models
  return candidates.map((m) => m.id);
}

// ---------------------------------------------------------------------------
// OpenRouter-compatible fetch
// ---------------------------------------------------------------------------

const OPENROUTER_BASE =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const MAX_FALLBACKS = 2;
const REQUEST_TIMEOUT_MS = 15_000;

async function callModel(
  modelId: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost",
      "X-Title": "InternalToolKit",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    }),
    signal: signal ?? null,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Model ${modelId} returned ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Model ${modelId} returned empty content`);
  return content;
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export async function routeRequest(
  rawPrompt: string,
  options: { mode?: RouterMode; taskClass?: TaskClass } = {},
): Promise<RouterResult> {
  const taskClass = options.taskClass ?? classifyTask(rawPrompt);
  const mode = options.mode ?? "fast";
  const safePrompt = redactSecrets(rawPrompt);
  const models = selectModels(taskClass, mode);
  const fallbackChain: string[] = [];

  let attempts = 0;

  for (const modelId of models) {
    if (attempts > MAX_FALLBACKS) break;
    attempts++;
    fallbackChain.push(modelId);

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      const content = await callModel(modelId, safePrompt, controller.signal);
      clearTimeout(timeout);

      recordSuccess(modelId);
      return {
        content,
        telemetry: {
          modelUsed: modelId,
          latencyMs: Date.now() - start,
          success: true,
          fallbackChain,
          taskClass,
        },
      };
    } catch {
      recordFailure(modelId);
    }
  }

  // All models failed — return a safe fallback
  return {
    content:
      "I'm temporarily unable to process this request. Please try again in a moment.",
    telemetry: {
      modelUsed: "none",
      latencyMs: 0,
      success: false,
      fallbackChain,
      taskClass,
    },
  };
}

// ---------------------------------------------------------------------------
// Health check (for coordinator view)
// ---------------------------------------------------------------------------

export interface ModelHealth {
  id: string;
  circuitOpen: boolean;
  failures: number;
  cooldownRemainingMs: number;
}

export function getModelHealth(): ModelHealth[] {
  const now = Date.now();
  return FREE_MODELS.map((m) => {
    const state = circuits.get(m.id);
    return {
      id: m.id,
      circuitOpen: isCircuitOpen(m.id),
      failures: state?.failures ?? 0,
      cooldownRemainingMs: state?.openUntil
        ? Math.max(0, state.openUntil - now)
        : 0,
    };
  });
}
