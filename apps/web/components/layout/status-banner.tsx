import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusBannerProps = {
  error: string | undefined;
  success: string | undefined;
  requestId?: string | undefined;
  errorId?: string | undefined;
};

function StatusBanner({ error, success, requestId, errorId }: StatusBannerProps) {
  if (!error && !success) {
    return null;
  }

  const isError = Boolean(error);

  return (
    <div
      className={cn(
        "mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
        isError
          ? "border-rose-300/40 bg-rose-300/10 text-rose-100"
          : "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
      )}
      role="status"
      aria-live="polite"
    >
      {isError ? (
        <AlertTriangle className="size-4" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      <div className="space-y-0.5">
        <span>{isError ? error : success}</span>
        {isError && (requestId || errorId) ? (
          <p className="text-xs opacity-80">
            {errorId ? `Error ID: ${errorId}` : null}
            {errorId && requestId ? " · " : null}
            {requestId ? `Request ID: ${requestId}` : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { StatusBanner };
