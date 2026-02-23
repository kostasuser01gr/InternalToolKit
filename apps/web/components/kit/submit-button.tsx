"use client";

import { useFormStatus } from "react-dom";

import { PrimaryButton } from "@/components/kit/primary-button";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for `<PrimaryButton type="submit">` inside forms
 * using Next.js server actions.  Shows a pending state automatically via
 * `useFormStatus()` so users get immediate click feedback.
 */
function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: React.ComponentProps<typeof PrimaryButton> & {
  /** Text shown while the server action is processing. Defaults to "Saving…" */
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(pending && "opacity-70", className)}
      {...props}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </PrimaryButton>
  );
}

export { SubmitButton };
