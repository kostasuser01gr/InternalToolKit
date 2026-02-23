"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Lightweight submit button with automatic pending state via `useFormStatus()`.
 * Use inside `<form action={serverAction}>` for secondary/inline action buttons
 * (e.g. Accept, Decline, Delete) that don't need PrimaryButton styling.
 */
function FormSubmitButton({
  children,
  pendingText = "…",
  className,
  ...props
}: React.ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(pending && "opacity-70", className)}
      {...props}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export { FormSubmitButton };
