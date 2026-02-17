import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
};

function SearchBar({
  className,
  placeholder = "Search data, runs, automations",
  id = "global-search",
  disabled = false,
  loading = false,
  error,
}: SearchBarProps) {
  const errorId = `${id}-error`;

  return (
    <form role="search" className={cn("relative w-full", className)}>
      <label htmlFor={id} className="sr-only">
        Search workspace
      </label>
      {loading ? (
        <Loader2
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
          aria-hidden="true"
        />
      ) : (
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        />
      )}
      <Input
        id={id}
        data-global-search-input
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-10 pl-9",
          error &&
            "border-rose-400/60 text-rose-100 placeholder:text-rose-200/80",
        )}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-rose-300" role="status">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export { SearchBar };
