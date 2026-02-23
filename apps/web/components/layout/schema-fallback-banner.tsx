import { AlertTriangle } from "lucide-react";

/**
 * Displays a non-blocking banner when a schema fallback was triggered.
 * Pass `active={true}` when any query fell back to empty data.
 */
export function SchemaFallbackBanner({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Some data could not be loaded — database migrations may be pending.
        Contact your administrator if this persists.
      </span>
    </div>
  );
}
