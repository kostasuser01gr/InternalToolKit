import { z } from "zod";

import { isSchemaNotReadyError } from "@/lib/prisma-errors";
import { AuthError } from "@/lib/rbac";

export const CHAT_SCHEMA_NOT_READY_MESSAGE =
  "Feature unavailable until database migrations are applied. Run db:migrate:deploy.";

export function getChatErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (isSchemaNotReadyError(error)) {
    return CHAT_SCHEMA_NOT_READY_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}
