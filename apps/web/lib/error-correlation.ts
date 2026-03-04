type ErrorWithDigest = Error & { digest?: string };

function capture(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match?.[1]?.trim();
}

export function extractCorrelationIds(error: ErrorWithDigest) {
  const text = `${error.message ?? ""}\n${error.stack ?? ""}`;

  const requestId =
    capture(text, /Request ID:\s*([A-Za-z0-9._:-]+)/i) ??
    capture(text, /requestId["'=:\s]+([A-Za-z0-9._:-]+)/i) ??
    capture(text, /x-request-id["'=:\s]+([A-Za-z0-9._:-]+)/i);

  const errorId =
    error.digest ??
    capture(text, /Error ID:\s*([A-Za-z0-9._:-]+)/i) ??
    capture(text, /errorId["'=:\s]+([A-Za-z0-9._:-]+)/i) ??
    capture(text, /Reference:\s*([A-Za-z0-9._:-]+)/i);

  return {
    errorId,
    requestId,
  };
}
