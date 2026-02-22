"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { features } from "@/lib/constants/features";

type QuickAction = {
  id: string;
  label: string;
  command: string;
  isRecommended?: boolean;
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

/** Role-based default shortcuts (fallback if workspace has no custom config) */
const ROLE_DEFAULTS_FALLBACK: Record<string, QuickAction[]> = {
  ADMIN: [
    { id: "rq-settings", label: "Settings", command: "route /settings" },
    { id: "rq-analytics", label: "Analytics", command: "route /analytics" },
    { id: "rq-imports", label: "Imports", command: "route /imports" },
  ],
  EMPLOYEE: [
    { id: "rq-tasks", label: "My Tasks", command: "route /washers" },
    { id: "rq-shifts", label: "My Shifts", command: "route /shifts" },
  ],
};

export function QuickBar({ userRole, roleShortcuts }: { userRole?: string | undefined; roleShortcuts?: Record<string, QuickAction[]> | undefined }) {
  const router = useRouter();
  const [actions, setActions] = useState<QuickAction[]>(DEFAULT_ACTIONS.slice(0, 4));
  const [recommended, setRecommended] = useState<QuickAction[]>([]);
  const [showRecommended, setShowRecommended] = useState(false);

  useEffect(() => {
    if (!features.customShortcuts) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch("/v1/shortcuts", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json() as { ok?: boolean; items?: QuickAction[] };
        if (!data.ok || !Array.isArray(data.items) || !active) return;

        const userActions = data.items.map((s) => ({
          id: s.id,
          label: s.label,
          command: s.command,
        }));

        // Merge: user shortcuts → role defaults → global defaults
        const workspaceRoleDefaults = roleShortcuts?.[userRole ?? "EMPLOYEE"];
        const roleDefaults = workspaceRoleDefaults ?? ROLE_DEFAULTS_FALLBACK[userRole ?? "EMPLOYEE"] ?? [];
        const merged = [...userActions, ...DEFAULT_ACTIONS].slice(0, 6);
        setActions(merged);

        // Show role recommendations that aren't already in user's bar
        const existingIds = new Set(merged.map((a) => a.id));
        const recs = roleDefaults.filter((r) => !existingIds.has(r.id));
        setRecommended(recs);
      } catch {
        // best effort
      }
    };

    void load();
    return () => { active = false; };
  }, [userRole, roleShortcuts]);

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

  const adoptRecommended = useCallback((action: QuickAction) => {
    setActions((prev) => {
      if (prev.length >= 6) return prev;
      return [...prev, { ...action, isRecommended: true }];
    });
    setRecommended((prev) => prev.filter((r) => r.id !== action.id));
  }, []);

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
      {recommended.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRecommended((v) => !v)}
            className="rounded-md border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 px-2 py-1 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10"
            title="Recommended shortcuts for your role"
          >
            <Plus className="size-3" />
          </button>
          {showRecommended ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-[var(--border)] bg-[rgb(15_16_22)] p-1 shadow-xl">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recommended
              </p>
              {recommended.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { adoptRecommended(r); setShowRecommended(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text)] hover:bg-white/10"
                >
                  <Check className="size-3 text-emerald-400" />
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
