import { z } from "zod";

const DEFAULT_API_URL = "http://127.0.0.1:8787";
const DEFAULT_DATABASE_URL = "file:./dev.db";

const envSchema = z.object({
  SESSION_SECRET: z.string().trim().min(16).optional(),
  NEXTAUTH_SECRET: z.string().trim().min(16).optional(),
  NEXT_PUBLIC_API_URL: z.string().trim().url().optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  APP_VERSION: z.string().trim().min(1).optional(),
  ASSISTANT_PROVIDER: z.enum(["mock", "openai"]).optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
});

export type ServerEnv = {
  SESSION_SECRET: string;
  NEXT_PUBLIC_API_URL: string;
  DATABASE_URL: string;
  APP_VERSION: string;
  ASSISTANT_PROVIDER: "mock" | "openai";
  OPENAI_API_KEY: string;
};

let cachedEnv: ServerEnv | null = null;

function isHostedProductionRuntime() {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  // `next build` evaluates server modules to collect route metadata.
  // During that phase we allow the local fallback secret so hosted builds
  // can complete before runtime env injection takes effect.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return false;
  }

  return (
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.VERCEL === "1"
  );
}

function configError(details: string): never {
  throw new Error(
    [
      "Invalid environment configuration.",
      details,
      "Fix: copy apps/web/.env.example to apps/web/.env.local and set values.",
      "Minimum required: SESSION_SECRET with at least 16 characters.",
    ].join("\n"),
  );
}

function parseEnv(): ServerEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    configError(
      `Env ${firstIssue?.path.join(".") || "value"} is invalid: ${firstIssue?.message || "unknown error"}`,
    );
  }

  const normalized = parsed.data;
  let secret = normalized.SESSION_SECRET ?? normalized.NEXTAUTH_SECRET;

  if (!secret) {
    if (isHostedProductionRuntime()) {
      configError("SESSION_SECRET (or NEXTAUTH_SECRET) is required.");
    }

    // Local fallback to keep fresh clones runnable without paid/managed secrets.
    secret = "dev-session-secret-change-before-production";
  }

  const provider = normalized.ASSISTANT_PROVIDER ?? "mock";
  const apiKey = normalized.OPENAI_API_KEY ?? "";

  if (provider === "openai" && !apiKey) {
    configError("ASSISTANT_PROVIDER=openai requires OPENAI_API_KEY.");
  }

  return {
    SESSION_SECRET: secret,
    NEXT_PUBLIC_API_URL: normalized.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
    DATABASE_URL: normalized.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    APP_VERSION: normalized.APP_VERSION ?? "1.0.0",
    ASSISTANT_PROVIDER: provider,
    OPENAI_API_KEY: apiKey,
  };
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = parseEnv();
  return cachedEnv;
}

export function validateServerEnv() {
  getServerEnv();
}
