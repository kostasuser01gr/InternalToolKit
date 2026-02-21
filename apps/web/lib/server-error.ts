import { AuthError } from "@/lib/rbac";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { getRequestContext } from "@/lib/request-context";

type MappedError = {
  message: string;
  errorId: string;
  requestId: string;
};

function getSafeMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (isSchemaNotReadyError(error)) {
    return "Database schema is not ready. Please run migrations.";
  }

  if (error instanceof Error) {
    if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
      return "Database connection failed. Please check your configuration.";
    }

    if (error.message.includes("not found") || error.name === "NotFoundError") {
      return error.message;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

export async function mapServerError(
  error: unknown,
  routeFallback = "unknown",
): Promise<MappedError> {
  const context = await getRequestContext(routeFallback);
  const errorId = crypto.randomUUID().slice(0, 12);

  return {
    message: getSafeMessage(error),
    errorId,
    requestId: context.requestId,
  };
}
