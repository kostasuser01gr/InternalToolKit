import { z } from "zod";

const DEFAULT_API_URL = "http://127.0.0.1:8787";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";
const MIN_SESSION_SECRET_LENGTH = 32;

const envSchema = z.object({
  SESSION_SECRET: z.string().trim().optional(),
  NEXTAUTH_SECRET: z.string().trim().optional(),
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

function isBuildPhase() {
  // `next build` evaluates server modules to collect route metadata.
  // During that phase, defer strict runtime-only checks.
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function isHostedProductionRuntime() {
  if (process.env.NODE_ENV !== "production" || isBuildPhase()) {
    return false;
  }

  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV) ||
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true"
  );
}

function shouldRequireDirectUrl() {
  const lifecycleEvent = process.env.npm_lifecycle_event ?? "";
  return (
    lifecycleEvent === "db:migrate:deploy" ||
    lifecycleEvent === "db:migrate:dev" ||
    lifecycleEvent === "db:push:dev" ||
    lifecycleEvent === "prisma:migrate"
  );
}

function isPostgresUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "postgresql:" || parsed.protocol === "postgres:";
  } catch {
    return false;
  }
}

function configError(details: string, missingKeys: string[] = []): never {
  const missingMessage =
    missingKeys.length > 0
      ? `Missing required env keys: ${missingKeys.join(", ")}.`
      : null;

  throw new Error(
    [
      "Invalid environment configuration.",
      ...(missingMessage ? [missingMessage] : []),
      details,
      "Fix: copy apps/web/.env.example to apps/web/.env.local and set values.",
      "Set env vars in Vercel Preview + Production, then redeploy.",
      "Required keys for hosted runtime: DATABASE_URL, SESSION_SECRET.",
      "DIRECT_URL is required for migration workflows (db:migrate:deploy).",
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
  const buildPhase = isBuildPhase();
  const isDevelopment = process.env.NODE_ENV === "development";
  const requiresDirectUrl = shouldRequireDirectUrl();

  const sessionSecret = normalized.SESSION_SECRET?.trim() || undefined;
  const nextAuthSecret = normalized.NEXTAUTH_SECRET?.trim() || undefined;
  const databaseUrl = normalized.DATABASE_URL?.trim() || undefined;
  const directUrl = normalized.DIRECT_URL?.trim() || undefined;
  const missingKeys: string[] = [];

  if (hostedProduction && !databaseUrl) {
    missingKeys.push("DATABASE_URL");
  }

  if (hostedProduction && !sessionSecret) {
    missingKeys.push("SESSION_SECRET");
  }

  if (requiresDirectUrl && !directUrl) {
    missingKeys.push("DIRECT_URL");
  }

  if (missingKeys.length > 0) {
    configError("Required environment values are missing.", missingKeys);
  }

  if (
    !buildPhase &&
    sessionSecret &&
    sessionSecret.length < MIN_SESSION_SECRET_LENGTH
  ) {
    configError(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  if (
    !buildPhase &&
    !sessionSecret &&
    nextAuthSecret &&
    nextAuthSecret.length < MIN_SESSION_SECRET_LENGTH
  ) {
    configError(
      `NEXTAUTH_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  let secret = sessionSecret ?? nextAuthSecret;
  if (!secret) {
    // Local fallback to keep fresh clones runnable without paid/managed secrets.
    secret = "dev-session-secret-change-before-production";
  }

  const allowSqliteDev = normalized.ALLOW_SQLITE_DEV === "1" && isDevelopment;
  const usesSqlite = databaseUrl?.startsWith("file:") ?? false;
  const usesSqliteDirect = directUrl?.startsWith("file:") ?? false;

  if (hostedProduction && usesSqlite) {
    configError(
      "DATABASE_URL must not use a local sqlite file in hosted production. Use a persistent database URL.",
    );
  }

  if (!buildPhase && usesSqlite && !allowSqliteDev) {
    configError(
      "DATABASE_URL uses file-based sqlite. This is only allowed for local development with ALLOW_SQLITE_DEV=1.",
    );
  }

  if (hostedProduction && usesSqliteDirect) {
    configError(
      "DIRECT_URL must not use a local sqlite file in hosted production. Use a Postgres direct connection URL.",
    );
  }

  if (hostedProduction && databaseUrl && !usesSqlite && !isPostgresUrl(databaseUrl)) {
    configError("DATABASE_URL must be a valid postgres:// or postgresql:// connection URL.");
  }

  if (
    hostedProduction &&
    directUrl &&
    !usesSqliteDirect &&
    !isPostgresUrl(directUrl)
  ) {
    configError("DIRECT_URL must be a valid postgres:// or postgresql:// connection URL.");
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
