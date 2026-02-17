import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PrimaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "bg-[image:var(--accent-purple-gradient)] text-white shadow-[var(--glow-shadow)] hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
}

export { PrimaryButton };
