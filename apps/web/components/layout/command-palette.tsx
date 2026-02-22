"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { Command, Loader2, MoonStar, PlusCircle, Search, SunMedium } from "lucide-react";
import type { ShortcutDefinition } from "@internal-toolkit/shared";

import { useToast } from "@/components/layout/toast-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { sidebarNavItems } from "@/lib/constants/navigation";
import { features } from "@/lib/constants/features";
import { cn } from "@/lib/utils";
import { logClientActivity } from "@/lib/activity/client";

type PaletteAction = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  run: () => Promise<void> | void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function CommandPalette() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingSequence, setPendingSequence] = useState<"g" | null>(null);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutDefinition[]>(
    [],
  );

  const sequenceTimerRef = useRef<number | null>(null);

  const actions = useMemo<PaletteAction[]>(() => {
    const routeActions = sidebarNavItems
      .filter(
        (item) => item.href !== "/components" || features.componentsShowroom,
      )
      .map((item) => ({
      id: `route-${item.href}`,
      label: `Go to ${item.label}`,
      description: `Navigate to ${item.label}.`,
      keywords: `${item.label} route goto ${item.href}`,
      run: () => {
        router.push(item.href);
      },
      }));

    const userActions: PaletteAction[] = customShortcuts.map((shortcut) => ({
      id: `shortcut-${shortcut.id}`,
      label: shortcut.label,
      description: shortcut.command,
      keywords: `${shortcut.label} ${shortcut.command} ${shortcut.keybinding ?? ""}`,
      run: async () => {
        const command = shortcut.command.trim();
        const normalized = command.toLowerCase();

        if (normalized.startsWith("route ")) {
          const route = command.slice(6).trim();
          if (route.startsWith("/")) {
            router.push(route);
            return;
          }
        }

        if (command.startsWith("/")) {
          router.push(`/chat?quickCommand=${encodeURIComponent(command)}`);
          return;
        }

        try {
          await navigator.clipboard.writeText(command);
          toast({
            title: `Copied "${shortcut.label}" command.`,
            tone: "success",
          });
        } catch {
          toast({
            title: "Unable to copy command.",
            tone: "error",
          });
        }
      },
    }));

    return [
      ...routeActions,
      ...userActions,
      {
        id: "go-analytics",
        label: "Go to Analytics",
        description: "Open KPI dashboards and trend cards.",
        keywords: "analytics dashboard charts",
        run: () => {
          router.push("/analytics");
        },
      },
      {
        id: "toggle-theme",
        label: "Toggle Theme",
        description: "Switch between dark and light theme.",
        keywords: "theme dark light appearance",
        run: async () => {
          const nextTheme = theme === "light" ? "dark" : "light";
          setTheme(nextTheme);
          toast({
            title: `Theme switched to ${nextTheme}.`,
            tone: "success",
          });
          await logClientActivity({
            action: "ui.theme_toggled",
            entityType: "ui_preference",
            entityId: "theme",
            meta: { theme: nextTheme },
          });
        },
      },
      {
        id: "create-demo-item",
        label: "Create Demo Item",
        description: "Create a sample item and log it in activity.",
        keywords: "create demo sample",
        run: async () => {
          const response = await fetch("/api/demo/create-item", {
            method: "POST",
          });

          if (!response.ok) {
            toast({
              title: "Unable to create demo item.",
              description: "Check your workspace permissions.",
              tone: "error",
            });
            return;
          }

          toast({
            title: "Demo item created.",
            description: "A notification and audit event were recorded.",
            tone: "success",
          });
        },
      },
    ];
  }, [customShortcuts, router, setTheme, theme, toast]);

  useEffect(() => {
    if (!features.customShortcuts) {
      return;
    }

    let active = true;

    const loadShortcuts = async () => {
      try {
        const response = await fetch("/v1/shortcuts", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          ok?: boolean;
          items?: ShortcutDefinition[];
        };
        if (!active || !payload.ok || !Array.isArray(payload.items)) {
          return;
        }

        setCustomShortcuts(payload.items);
      } catch {
        // Best-effort enhancement only.
      }
    };

    void loadShortcuts();

    return () => {
      active = false;
    };
  }, []);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return actions;
    }

    return actions.filter((item) =>
      `${item.label} ${item.description} ${item.keywords}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [actions, query]);

  // Server-side search results (debounced)
  type SearchResult = { type: string; id: string; title: string; subtitle?: string; url?: string };
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<number | null>(null);

  const searchServer = useCallback(async (q: string) => {
    if (q.length < 2) { setServerResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json() as { results: SearchResult[] };
        setServerResults(data.results ?? []);
      }
    } catch { /* best effort */ }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    const q = query.trim();
    if (q.length < 2) { setServerResults([]); return; }
    searchTimerRef.current = window.setTimeout(() => { void searchServer(q); }, 300);
    return () => { if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current); };
  }, [query, searchServer]);

  useEffect(() => {
    if (!features.commandPalette) {
      return;
    }

    function clearSequence() {
      setPendingSequence(null);

      if (sequenceTimerRef.current) {
        window.clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = null;
      }
    }

    function startSequence() {
      setPendingSequence("g");

      if (sequenceTimerRef.current) {
        window.clearTimeout(sequenceTimerRef.current);
      }

      sequenceTimerRef.current = window.setTimeout(() => {
        clearSequence();
      }, 900);
    }

    async function handleKeyDown(event: KeyboardEvent) {
      const lowerKey = event.key.toLowerCase();
      const typing = isTypingTarget(event.target);
      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

      if ((event.metaKey || event.ctrlKey) && lowerKey === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (lowerKey === "escape") {
        setOpen(false);
        clearSequence();
        return;
      }

      if (!typing && !hasModifier && event.key === "/") {
        event.preventDefault();
        const target = document.querySelector<HTMLInputElement>(
          "[data-global-search-input]",
        );
        target?.focus();
        target?.select();
        return;
      }

      if (typing || hasModifier) {
        return;
      }

      if (pendingSequence === "g") {
        if (lowerKey === "d") {
          event.preventDefault();
          router.push("/dashboard");
          clearSequence();
          return;
        }

        if (lowerKey === "a") {
          event.preventDefault();
          router.push("/analytics");
          clearSequence();
          return;
        }

        clearSequence();
        return;
      }

      if (lowerKey === "g") {
        startSequence();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimerRef.current) {
        window.clearTimeout(sequenceTimerRef.current);
      }
    };
  }, [pendingSequence, router]);

  if (!features.commandPalette) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring hidden items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2 text-xs text-[var(--text-muted)] lg:inline-flex"
        aria-label="Open command palette"
      >
        <Command className="size-3.5" aria-hidden="true" />
        Command
        <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">
          ⌘K / Ctrl+K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl border-[var(--border)] bg-[var(--surface-2)] p-0"
          data-testid="command-palette"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <div className="border-b border-[var(--border)] px-3 py-2">
            <label htmlFor="command-palette-input" className="sr-only">
              Search commands
            </label>
            <div className="flex items-center gap-2">
              <Search className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                id="command-palette-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search routes and actions..."
                className="focus-ring h-10 w-full rounded-[var(--radius-sm)] border border-transparent bg-transparent px-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {filteredActions.length === 0 && serverResults.length === 0 && !searching ? (
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                No command matches your search.
              </div>
            ) : (
              <>
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={async () => {
                    await action.run();
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "focus-ring mb-1 flex w-full items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 text-left hover:border-[var(--border)] hover:bg-white/5",
                    pathname.includes(action.id.replace("route-", "")) &&
                      "border-[#9a6fff66] bg-[#9a6fff1f]",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{action.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{action.description}</p>
                  </div>
                  {action.id === "toggle-theme" ? (
                    theme === "light" ? (
                      <MoonStar className="size-4 text-[var(--text-muted)]" />
                    ) : (
                      <SunMedium className="size-4 text-[var(--text-muted)]" />
                    )
                  ) : action.id === "create-demo-item" ? (
                    <PlusCircle className="size-4 text-[var(--text-muted)]" />
                  ) : null}
                </button>
              ))}
              {searching && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-muted)]">
                  <Loader2 className="size-3 animate-spin" /> Searching…
                </div>
              )}
              {serverResults.length > 0 && (
                <>
                  <div className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Search Results
                  </div>
                  {serverResults.map((r) => (
                    <button
                      key={`sr-${r.type}-${r.id}`}
                      type="button"
                      onClick={() => {
                        if (r.url) router.push(r.url);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="focus-ring mb-1 flex w-full items-start gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 text-left hover:border-[var(--border)] hover:bg-white/5"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-[var(--text-muted)]">{r.subtitle}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CommandPalette };
