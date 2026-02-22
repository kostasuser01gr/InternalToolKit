"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { features } from "@/lib/constants/features";

type QuickAction = {
  id: string;
  label: string;
  command: string;
};

/** Default recommended actions available to all users */
const DEFAULT_ACTIONS: QuickAction[] = [
  { id: "qa-new-task", label: "New Task", command: "route /washers" },
  { id: "qa-daily-reg", label: "Daily Register", command: "route /washers" },
  { id: "qa-fleet", label: "Fleet", command: "route /fleet" },
  { id: "qa-shifts", label: "Shifts", command: "route /shifts" },
  { id: "qa-feeds", label: "Feeds", command: "route /feeds" },
  { id: "qa-imports", label: "Imports", command: "route /imports" },
];

export function QuickBar() {
  const router = useRouter();
  const [actions, setActions] = useState<QuickAction[]>(DEFAULT_ACTIONS.slice(0, 4));

  // Load user-defined shortcuts and merge with defaults
  useEffect(() => {
    if (!features.customShortcuts) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch("/v1/shortcuts", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json() as { ok?: boolean; items?: QuickAction[] };
        if (!data.ok || !Array.isArray(data.items) || !active) return;

        // User shortcuts first, then fill with defaults up to 6
        const userActions = data.items.map((s) => ({
          id: s.id,
          label: s.label,
          command: s.command,
        }));
        const merged = [...userActions, ...DEFAULT_ACTIONS].slice(0, 6);
        setActions(merged);
      } catch {
        // best effort
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const executeAction = useCallback((action: QuickAction) => {
    const cmd = action.command.trim();
    if (cmd.toLowerCase().startsWith("route ")) {
      const route = cmd.slice(6).trim();
      if (route.startsWith("/")) router.push(route);
    } else if (cmd.startsWith("/")) {
      router.push(`/chat?quickCommand=${encodeURIComponent(cmd)}`);
    } else {
      router.push(cmd.startsWith("/") ? cmd : "/home");
    }
  }, [router]);

  return (
    <div className="hidden items-center gap-1 lg:flex" data-testid="quick-bar">
      <Zap className="size-3.5 text-[var(--text-muted)]" aria-hidden />
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => executeAction(action)}
          className={cn(
            "rounded-md border border-[var(--border)] bg-white/5 px-2.5 py-1 text-[11px] font-medium",
            "text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text)]",
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
