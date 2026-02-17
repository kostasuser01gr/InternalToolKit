import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "focus-ring flex min-h-20 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/3 px-3 py-2 text-sm text-[var(--text)] shadow-sm transition-colors placeholder:text-[var(--text-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
