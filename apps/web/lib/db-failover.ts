const DB_CONNECTIVITY_ERROR_RE =
  /(invalid url|can't reach database server|econnrefused|econnreset|timed out|timeout|p1001|tenant or user not found)/i;

export function isDatabaseConnectivityError(error: unknown) {
  if (error instanceof Error) {
    return DB_CONNECTIVITY_ERROR_RE.test(error.message);
  }

  if (typeof error === "string") {
    return DB_CONNECTIVITY_ERROR_RE.test(error);
  }

  return false;
}

export function createDatabaseUrlCandidates(input: {
  databaseUrl: string;
  directUrl?: string | null;
}) {
  const primary = input.databaseUrl.trim();
  const normalizedDirect = input.directUrl?.trim() ?? "";
  const fallback =
    normalizedDirect.length > 0 && normalizedDirect !== primary
      ? normalizedDirect
      : null;

  return {
    primary,
    fallback,
  };
}

export function createSingleFailoverRunner(options: {
  hasFallback: boolean;
  isConnectivityError?: (error: unknown) => boolean;
}) {
  const isConnectivityError =
    options.isConnectivityError ?? isDatabaseConnectivityError;
  let failoverAttempted = false;

  return {
    hasAttemptedFailover() {
      return failoverAttempted;
    },
    async run<T>(
      operation: () => Promise<T>,
      retryOperation: (error: unknown) => Promise<T>,
    ) {
      try {
        return await operation();
      } catch (error) {
        if (!options.hasFallback || failoverAttempted || !isConnectivityError(error)) {
          throw error;
        }

        failoverAttempted = true;
        return retryOperation(error);
      }
    },
  };
}
