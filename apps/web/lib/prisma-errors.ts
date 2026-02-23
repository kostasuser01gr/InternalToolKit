const SCHEMA_NOT_READY_ERROR_RE =
  /(table .* does not exist|relation .* does not exist|column .* does not exist|p2021|p2022|the table .* does not exist in the current database)/i;

const CONNECTION_ERROR_RE =
  /(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection.*refused|connect.*timeout|endpoint.*unavailable)/i;

/** Prisma error codes indicating the database server is unreachable or misconfigured. */
const DB_UNAVAILABLE_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1003", // Database does not exist
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
]);

export function isPrismaKnownErrorCode(error: unknown, code: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const actualCode = (error as { code?: unknown }).code;
  return (
    typeof actualCode === "string" &&
    actualCode.toUpperCase() === code.toUpperCase()
  );
}

export function isConnectionError(error: unknown) {
  if (isPrismaKnownErrorCode(error, "P1001") || isPrismaKnownErrorCode(error, "P1002")) {
    return true;
  }
  if (error instanceof Error) {
    return CONNECTION_ERROR_RE.test(error.message);
  }
  return false;
}

/**
 * Returns true when the database is unavailable (connection, timeout, or schema errors).
 * Use this in SSR pages to degrade gracefully instead of crashing with 500.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (isConnectionError(error)) return true;
  if (isSchemaNotReadyError(error)) return true;

  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code).toUpperCase();
    if (DB_UNAVAILABLE_CODES.has(code)) return true;
  }

  return false;
}

/** Run a Prisma query and return a fallback value when the database is unavailable. */
export async function withDbFallback<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (error) {
    if (isDatabaseUnavailableError(error)) return fallback;
    throw error;
  }
}

export function isSchemaNotReadyError(error: unknown) {
  // Connection errors are NOT schema-not-ready — they should surface as operational errors
  if (isConnectionError(error)) {
    return false;
  }

  if (isPrismaKnownErrorCode(error, "P2021")) {
    return true;
  }

  if (isPrismaKnownErrorCode(error, "P2022")) {
    return true;
  }

  if (error instanceof Error) {
    return SCHEMA_NOT_READY_ERROR_RE.test(error.message);
  }

  if (typeof error === "string") {
    return SCHEMA_NOT_READY_ERROR_RE.test(error);
  }

  return false;
}
