"use client";

import { useEffect, useId } from "react";

import { extractCorrelationIds } from "@/lib/error-correlation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const localErrorId = useId();
  const correlation = extractCorrelationIds(error);
  const displayErrorId = correlation.errorId ?? localErrorId;
  const displayRequestId = correlation.requestId;

  useEffect(() => {
    console.error("[GlobalError]", {
      errorId: displayErrorId,
      requestId: displayRequestId,
      message: error.message,
    });
  }, [error, displayErrorId, displayRequestId]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#070913",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 480, padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>
            An unexpected error occurred. Try reloading the page.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.75rem" }}>
            Error ID: <code>{displayErrorId}</code>
          </p>
          {displayRequestId ? (
            <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Request ID: <code>{displayRequestId}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
