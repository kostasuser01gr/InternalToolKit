import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-white/8 text-[var(--text)]",
        active: "border-[#9a6fff66] bg-[#9a6fff22] text-[var(--text)]",
        success: "border-emerald-400/40 bg-emerald-400/12 text-emerald-200",
        danger: "border-rose-400/40 bg-rose-400/12 text-rose-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
