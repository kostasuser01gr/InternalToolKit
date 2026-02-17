import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusBannerProps = {
  error: string | undefined;
  success: string | undefined;
};

function StatusBanner({ error, success }: StatusBannerProps) {
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
      <span>{isError ? error : success}</span>
    </div>
  );
}

export { StatusBanner };
