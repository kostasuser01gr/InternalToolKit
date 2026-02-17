type NextRedirectError = {
  digest: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function rethrowIfRedirectError(error: unknown) {
  if (!isObject(error)) {
    return;
  }

  if (!("digest" in error)) {
    return;
  }

  const digest = (error as NextRedirectError).digest;

  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
    throw error;
  }
}
