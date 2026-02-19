import { z } from "zod";

const DEFAULT_API_URL = "http://127.0.0.1:8787";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";

const envSchema = z.object({
  SESSION_SECRET: z.string().trim().min(16).optional(),
  NEXTAUTH_SECRET: z.string().trim().min(16).optional(),
  NEXT_PUBLIC_API_URL: z.string().trim().url().optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  DIRECT_URL: z.string().trim().min(1).optional(),
  ALLOW_SQLITE_DEV: z.enum(["0", "1"]).optional(),
  APP_VERSION: z.string().trim().min(1).optional(),
  ASSISTANT_PROVIDER: z.enum(["mock", "openai"]).optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
});

export type ServerEnv = {
  SESSION_SECRET: string;
  NEXT_PUBLIC_API_URL: string;
  DATABASE_URL: string;
  DIRECT_URL: string;
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
      "Vercel required vars: DATABASE_URL, SESSION_SECRET (DIRECT_URL is required for migrations).",
      "Supabase: use pooled URI for DATABASE_URL and direct URI for DIRECT_URL.",
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
  const hostedProduction = isHostedProductionRuntime();
  let secret = normalized.SESSION_SECRET ?? normalized.NEXTAUTH_SECRET;

  if (!secret) {
    if (hostedProduction) {
      configError("SESSION_SECRET (or NEXTAUTH_SECRET) is required.");
    }

    // Local fallback to keep fresh clones runnable without paid/managed secrets.
    secret = "dev-session-secret-change-before-production";
  }

  const allowSqliteDev = normalized.ALLOW_SQLITE_DEV === "1";
  const databaseUrl = normalized.DATABASE_URL;
  const directUrl = normalized.DIRECT_URL;

  if (hostedProduction && !databaseUrl) {
    configError("DATABASE_URL is required and must point to a writable production database.");
  }

  if (hostedProduction && databaseUrl?.startsWith("file:")) {
    configError(
      "DATABASE_URL must not use a local sqlite file in hosted production. Use a persistent database URL.",
    );
  }

  if (!hostedProduction && databaseUrl?.startsWith("file:") && !allowSqliteDev) {
    configError(
      "File-based sqlite URL detected. Set ALLOW_SQLITE_DEV=1 only for local debugging, or switch DATABASE_URL to Postgres.",
    );
  }

  const provider = normalized.ASSISTANT_PROVIDER ?? "mock";
  const apiKey = normalized.OPENAI_API_KEY ?? "";

  if (provider === "openai" && !apiKey) {
    configError("ASSISTANT_PROVIDER=openai requires OPENAI_API_KEY.");
  }

  return {
    SESSION_SECRET: secret,
    NEXT_PUBLIC_API_URL: normalized.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
    DATABASE_URL: databaseUrl ?? DEFAULT_DATABASE_URL,
    DIRECT_URL: directUrl ?? databaseUrl ?? DEFAULT_DATABASE_URL,
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
