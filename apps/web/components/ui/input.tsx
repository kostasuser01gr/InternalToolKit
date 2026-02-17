import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "focus-ring flex h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/4 px-3 py-2 text-sm text-[var(--text)] shadow-sm transition-colors placeholder:text-[var(--text-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
