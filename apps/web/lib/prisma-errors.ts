const SCHEMA_NOT_READY_ERROR_RE =
  /(table .* does not exist|relation .* does not exist|column .* does not exist|p2021|p2022|the table .* does not exist in the current database)/i;

const CONNECTION_ERROR_RE =
  /(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection.*refused|connect.*timeout|endpoint.*unavailable)/i;

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
  if (error instanceof Error) {
    return CONNECTION_ERROR_RE.test(error.message);
  }
  return false;
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
