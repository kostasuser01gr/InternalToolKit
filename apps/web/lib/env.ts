import { z } from "zod";

const DEFAULT_API_URL = "http://127.0.0.1:8787";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";
const MIN_SESSION_SECRET_LENGTH = 32;
const POSTGRES_PROTOCOL_RE = /^postgres(?:ql)?:\/\//i;
const DB_ENV_ASSIGNMENT_RE = /^(?:export\s+)?(DATABASE_URL|DIRECT_URL)\s*=/i;

const envSchema = z.object({
  SESSION_SECRET: z.string().trim().optional(),
  NEXTAUTH_SECRET: z.string().trim().optional(),
  NEXT_PUBLIC_API_URL: z.string().trim().url().optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  DIRECT_URL: z.string().trim().min(1).optional(),
  ALLOW_SQLITE_DEV: z.enum(["0", "1"]).optional(),
  APP_VERSION: z.string().trim().min(1).optional(),
  FREE_ONLY_MODE: z.enum(["0", "1"]).optional(),
  AI_PROVIDER_MODE: z.enum(["cloud_free", "mock"]).optional(),
  AI_ALLOW_PAID: z.enum(["0", "1"]).optional(),
  ASSISTANT_PROVIDER: z.enum(["mock", "openai"]).optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  GOOGLE_API_KEY: z.string().trim().optional(),
  COHERE_API_KEY: z.string().trim().optional(),
});

export type ServerEnv = {
  SESSION_SECRET: string;
  NEXT_PUBLIC_API_URL: string;
  DATABASE_URL: string;
  DIRECT_URL: string;
  APP_VERSION: string;
  FREE_ONLY_MODE: true;
  AI_PROVIDER_MODE: "cloud_free" | "mock";
  AI_ALLOW_PAID: false;
};

let cachedEnv: ServerEnv | null = null;
let cachedDatabaseUrl: string | null = null;

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

function normalizeEnvUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  let normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (DB_ENV_ASSIGNMENT_RE.test(normalized)) {
    const [, ...rest] = normalized.split("=");
    normalized = rest.join("=").trim();
  }

  if (!normalized) {
    return undefined;
  }

  const isSingleQuoted =
    normalized.startsWith("'") &&
    normalized.endsWith("'") &&
    normalized.length >= 2;
  const isDoubleQuoted =
    normalized.startsWith('"') &&
    normalized.endsWith('"') &&
    normalized.length >= 2;

  if (!isSingleQuoted && !isDoubleQuoted) {
    return normalized;
  }

  const unquoted = normalized.slice(1, -1).trim();
  return unquoted || undefined;
}

function isPostgresProtocolUrl(value: string) {
  return POSTGRES_PROTOCOL_RE.test(value);
}

function isStructurallyValidPostgresUrl(value: string) {
  if (!isPostgresProtocolUrl(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const hasHost = Boolean(parsed.hostname);
    const hasPath = parsed.pathname.length > 1;
    return hasHost && hasPath;
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
      "Free-only keys: FREE_ONLY_MODE=1, AI_ALLOW_PAID=0, AI_PROVIDER_MODE=cloud_free|mock.",
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
  const databaseUrl = normalizeEnvUrl(normalized.DATABASE_URL);
  const directUrl = normalizeEnvUrl(normalized.DIRECT_URL);
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

  if (
    hostedProduction &&
    databaseUrl &&
    !usesSqlite &&
    !isPostgresProtocolUrl(databaseUrl)
  ) {
    configError("DATABASE_URL must be a valid postgres:// or postgresql:// connection URL.");
  }

  if (
    hostedProduction &&
    databaseUrl &&
    !usesSqlite &&
    !isStructurallyValidPostgresUrl(databaseUrl)
  ) {
    configError(
      "DATABASE_URL appears malformed. Use the raw URI value only, URL-encode special password characters, then redeploy.",
    );
  }

  if (
    hostedProduction &&
    directUrl &&
    !usesSqliteDirect &&
    !isPostgresProtocolUrl(directUrl)
  ) {
    configError("DIRECT_URL must be a valid postgres:// or postgresql:// connection URL.");
  }

  if (
    hostedProduction &&
    directUrl &&
    !usesSqliteDirect &&
    !isStructurallyValidPostgresUrl(directUrl)
  ) {
    configError(
      "DIRECT_URL appears malformed. Use the raw URI value only, URL-encode special password characters, then redeploy.",
    );
  }

  const providerFromLegacy =
    normalized.ASSISTANT_PROVIDER === "openai" ? "cloud_free" : "mock";
  const providerMode = normalized.AI_PROVIDER_MODE ?? providerFromLegacy;
  const freeOnlyModeRaw = normalized.FREE_ONLY_MODE ?? "1";
  const allowPaidRaw = normalized.AI_ALLOW_PAID ?? "0";
  const hasPaidTokenConfigured = [
    normalized.OPENAI_API_KEY,
    normalized.ANTHROPIC_API_KEY,
    normalized.GOOGLE_API_KEY,
    normalized.COHERE_API_KEY,
  ].some((value) => Boolean(value && value.trim()));

  if (freeOnlyModeRaw !== "1") {
    configError("FREE_ONLY_MODE must remain set to 1.");
  }

  if (allowPaidRaw !== "0") {
    configError("AI_ALLOW_PAID must remain set to 0 in free-only mode.");
  }

  if (!buildPhase && hasPaidTokenConfigured) {
    configError(
      "Paid provider API keys are not allowed in free-only mode. Remove OPENAI_API_KEY/ANTHROPIC_API_KEY/GOOGLE_API_KEY/COHERE_API_KEY.",
    );
  }

  if (hostedProduction && providerMode !== "cloud_free" && providerMode !== "mock") {
    configError("AI_PROVIDER_MODE must be cloud_free or mock.");
  }

  return {
    SESSION_SECRET: secret,
    NEXT_PUBLIC_API_URL: normalized.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
    DATABASE_URL: databaseUrl ?? DEFAULT_DATABASE_URL,
    DIRECT_URL: directUrl ?? databaseUrl ?? DEFAULT_DATABASE_URL,
    APP_VERSION: normalized.APP_VERSION ?? "1.0.0",
    FREE_ONLY_MODE: true,
    AI_PROVIDER_MODE: providerMode,
    AI_ALLOW_PAID: false,
  };
}

function parseDatabaseUrl() {
  // Keep DB client initialization non-throwing for routes that don't require DB access.
  // Strict hosted env validation is enforced by getServerEnv()/health checks.
  return normalizeEnvUrl(process.env.DATABASE_URL) || DEFAULT_DATABASE_URL;
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = parseEnv();
  return cachedEnv;
}

export function getDatabaseUrl() {
  if (cachedDatabaseUrl) {
    return cachedDatabaseUrl;
  }

  cachedDatabaseUrl = parseDatabaseUrl();
  return cachedDatabaseUrl;
}

export function getDirectDatabaseUrl() {
  return normalizeEnvUrl(process.env.DIRECT_URL);
}

export function validateServerEnv() {
  getServerEnv();
}

export function getAuthRuntimeEnvError() {
  const databaseUrl = normalizeEnvUrl(process.env.DATABASE_URL) ?? "";
  const sessionSecret =
    process.env.SESSION_SECRET?.trim() ??
    process.env.NEXTAUTH_SECRET?.trim() ??
    "";
  const freeOnlyMode = process.env.FREE_ONLY_MODE?.trim() || "1";
  const aiAllowPaid = process.env.AI_ALLOW_PAID?.trim() || "0";
  const isDevelopment = process.env.NODE_ENV === "development";
  const hostedProduction = isHostedProductionRuntime();
  const allowSqliteDev = process.env.ALLOW_SQLITE_DEV === "1";

  if (!databaseUrl) {
    return hostedProduction ? "Set DATABASE_URL." : null;
  }

  if (!sessionSecret) {
    return hostedProduction ? "Set SESSION_SECRET." : null;
  }

  if (hostedProduction && sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    return `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`;
  }

  if (databaseUrl.startsWith("file:")) {
    if (!isDevelopment) {
      return "Set DATABASE_URL to the Supabase pooler URI; ensure it starts with postgresql:// or postgres://. file: is only allowed in development.";
    }

    if (!allowSqliteDev) {
      return "Set ALLOW_SQLITE_DEV=1 to use a file-based DATABASE_URL in development.";
    }

    return null;
  }

  if (hostedProduction && !isPostgresProtocolUrl(databaseUrl)) {
    return "Set DATABASE_URL to the Supabase pooler URI; ensure it starts with postgresql:// or postgres://.";
  }

  if (hostedProduction && !isStructurallyValidPostgresUrl(databaseUrl)) {
    return "Set DATABASE_URL to a valid postgres:// or postgresql:// URI (raw value only). URL-encode special password characters, then redeploy.";
  }

  if (freeOnlyMode !== "1") {
    return "Set FREE_ONLY_MODE=1.";
  }

  if (aiAllowPaid !== "0") {
    return "Set AI_ALLOW_PAID=0.";
  }

  return null;
}
