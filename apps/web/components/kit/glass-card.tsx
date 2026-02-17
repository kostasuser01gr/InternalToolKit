"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { useUiPreferences } from "@/components/layout/ui-preferences-provider";
import { cn } from "@/lib/utils";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  "data-testid"?: string;
};

function GlassCard({
  children,
  className,
  interactive = false,
  ...props
}: GlassCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { reduceMotion } = useUiPreferences();
  const shouldReduceMotion = prefersReducedMotion || reduceMotion;
  const hoverProps =
    interactive && !shouldReduceMotion ? { whileHover: { y: -2 } } : {};

  return (
    <motion.section
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
      className={cn(
        "glass-surface rounded-[var(--radius-md)] p-[var(--density-card-padding)]",
        interactive && "transition hover:shadow-[var(--glow-shadow)]",
        className,
      )}
      {...hoverProps}
      {...props}
    >
      {children}
    </motion.section>
  );
}

export { GlassCard };
