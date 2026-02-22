"use client";

import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Database,
  Droplets,
  CarFront,
  FileText,
  Home,
  Inbox,
  LogOut,
  MessageSquare,
  Newspaper,
  PanelRightOpen,
  Pin,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CommandPalette } from "@/components/layout/command-palette";
import { CreateSheet } from "@/components/layout/create-sheet";
import { QuickBar } from "@/components/layout/quick-bar";
import { UndoToast } from "@/components/kit/undo-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

// Polyfill requestIdleCallback for environments that don't support it
const requestIdleCallback = typeof window !== "undefined" && window.requestIdleCallback
  ? window.requestIdleCallback
  : (cb: () => void) => setTimeout(cb, 1) as unknown as number;
const cancelIdleCallback = typeof window !== "undefined" && window.cancelIdleCallback
  ? window.cancelIdleCallback
  : (id: number) => clearTimeout(id);

type ChatFirstShellProps = {
  children: React.ReactNode;
  workspaceName: string;
  userName: string;
  userRole?: string | undefined;
  roleShortcuts?: Record<string, Array<{ id: string; label: string; command: string }>> | undefined;
};

const moduleShortcuts = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/ops-inbox", label: "Ops Inbox", icon: Inbox },
  { href: "/overview", label: "Overview", icon: ChartNoAxesCombined },
  { href: "/data", label: "Data", icon: Database },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/fleet", label: "Fleet", icon: CarFront },
  { href: "/washers", label: "Washers", icon: Droplets },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/controls", label: "Controls", icon: SlidersHorizontal },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/feeds", label: "Feeds", icon: Newspaper },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const pinnedConversations = [
  { id: "ops", title: "Ops Command Center" },
  { id: "daily", title: "Daily Standup" },
] as const;

function ChatFirstShell({
  children,
  workspaceName,
  userName,
  userRole,
  roleShortcuts,
}: ChatFirstShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);

  // Prefetch core routes on idle for instant navigation
  useEffect(() => {
    const coreRoutes = ["/home", "/ops-inbox", "/chat", "/washers", "/fleet", "/shifts", "/feeds", "/settings"];
    const id = requestIdleCallback(() => {
      for (const route of coreRoutes) {
        if (route !== pathname) router.prefetch(route);
      }
    });
    return () => cancelIdleCallback(id);
  }, [pathname, router]);

  return (
    <div
      className="app-viewport-min relative flex flex-col"
      data-shell-root="true"
      data-chat-first="true"
    >
      {/* ── Top Bar ── */}
      <header className="safe-pl safe-pr sticky top-0 z-40 border-b border-[var(--border)] bg-[rgb(6_7_12_/_0.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-3 lg:px-5">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white/5 text-[var(--text-muted)] lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <Sparkles className="size-4" />
          </button>

          {/* Logo/Workspace */}
          <Link href="/chat" className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#9a6fff] to-[#6366f1] text-xs font-bold text-white">
              IT
            </span>
            <span className="hidden text-sm font-semibold text-[var(--text)] lg:inline truncate max-w-32">
              {workspaceName}
            </span>
          </Link>

          {/* Search */}
          <div className="flex flex-1 items-center justify-center">
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search or ask anything…"
                className="focus-ring h-9 w-full rounded-xl border border-[var(--border)] bg-white/5 pl-9 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* Quick Bar */}
          <QuickBar userRole={userRole} roleShortcuts={roleShortcuts} />

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <CommandPalette />
            <CreateSheet />

            <button
              type="button"
              onClick={toggleDrawer}
              className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white/5 text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label="Toggle tool drawer"
            >
              <PanelRightOpen className="size-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/6 pl-1 pr-2.5 py-1 text-sm"
                  aria-label="Profile menu"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#9a6fff2b] text-xs font-semibold text-[var(--text)]">
                    {userName.slice(0, 2).toUpperCase()}
                  </span>
                  <ChevronDown className="size-3.5 text-[var(--text-muted)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/settings" className="cursor-pointer">
                    <Settings className="size-4" />
                    Settings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logoutSession();
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Main Layout: left rail + center + right drawer ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Rail — conversations + module shortcuts */}
        <aside
          className={cn(
            "w-64 shrink-0 border-r border-[var(--border)] bg-[rgb(6_7_12_/_0.5)] flex flex-col transition-transform duration-200",
            "max-lg:fixed max-lg:inset-y-14 max-lg:left-0 max-lg:z-30 max-lg:w-72 max-lg:shadow-2xl",
            mobileMenuOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          )}
        >
          {/* New Chat */}
          <div className="p-3">
            <Link
              href="/chat"
              className="focus-ring flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2.5 text-sm text-[var(--text)] hover:bg-white/10"
            >
              <Plus className="size-4" />
              New conversation
            </Link>
          </div>

          {/* Pinned */}
          <div className="px-3 pb-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              <Pin className="size-3" />
              Pinned
            </p>
            <div className="space-y-0.5">
              {pinnedConversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/chat?threadId=${conv.id}`}
                  className="focus-ring block truncate rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:bg-white/7 hover:text-[var(--text)]"
                >
                  {conv.title}
                </Link>
              ))}
            </div>
          </div>

          {/* Module Shortcuts */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Modules
            </p>
            <nav className="space-y-0.5" aria-label="Module navigation">
              {moduleShortcuts
                .map(({ href, icon: Icon, label }) => {
                  const active =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                        active
                          ? "bg-[#9a6fff20] text-[var(--text)] shadow-[0_0_12px_rgba(154,111,255,0.1)]"
                          : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {label}
                    </Link>
                  );
                })}
            </nav>
          </div>

          {/* Workspace badge */}
          <div className="border-t border-[var(--border)] p-3">
            <p className="text-[10px] text-[var(--text-muted)] truncate">
              {workspaceName} · Internal Tools
            </p>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen ? (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        {/* Center Content */}
        <main
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto"
        >
          <div className="mx-auto max-w-[900px] px-4 py-5 lg:px-8 lg:py-6">
            {children}
          </div>
          <UndoToast />
        </main>

        {/* Right Tool Drawer */}
        <aside
          className={cn(
            "border-l border-[var(--border)] bg-[rgb(6_7_12_/_0.5)] transition-all duration-200 overflow-y-auto",
            "max-lg:fixed max-lg:inset-y-14 max-lg:right-0 max-lg:z-30 max-lg:w-80 max-lg:shadow-2xl",
            drawerOpen
              ? "w-80 lg:w-80 max-lg:translate-x-0"
              : "w-0 lg:w-0 max-lg:translate-x-full",
          )}
        >
          {drawerOpen ? (
            <div className="w-80 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  Tool Drawer
                </h2>
                <button
                  type="button"
                  onClick={toggleDrawer}
                  className="focus-ring inline-flex size-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)]"
                  aria-label="Close drawer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Quick Actions */}
              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/shifts"
                    className="focus-ring flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-white/5 p-3 text-[11px] text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]"
                  >
                    <CalendarDays className="size-5" />
                    New Shift
                  </Link>
                  <Link
                    href="/fleet"
                    className="focus-ring flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-white/5 p-3 text-[11px] text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]"
                  >
                    <CarFront className="size-5" />
                    Fleet Event
                  </Link>
                  <Link
                    href="/automations"
                    className="focus-ring flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-white/5 p-3 text-[11px] text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]"
                  >
                    <Workflow className="size-5" />
                    Automation
                  </Link>
                  <Link
                    href="/reports"
                    className="focus-ring flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-white/5 p-3 text-[11px] text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]"
                  >
                    <FileText className="size-5" />
                    Report
                  </Link>
                </div>
              </section>

              {/* Entity Quick View */}
              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  System Status
                </p>
                <div className="rounded-xl border border-[var(--border)] bg-white/5 p-3 text-xs text-[var(--text-muted)] space-y-1">
                  <div className="flex justify-between">
                    <span>Database</span>
                    <span className="text-emerald-400">Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span>API</span>
                    <span className="text-emerald-400">Healthy</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-[var(--text)]">{process.env.APP_VERSION ?? "1.0.0"}</span>
                  </div>
                </div>
              </section>

              {/* Recent Activity */}
              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Module Links
                </p>
                <div className="space-y-1">
                  {moduleShortcuts.slice(0, 6).map(({ href, icon: Icon, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="focus-ring flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </aside>

        {/* Drawer overlay on mobile */}
        {drawerOpen ? (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={toggleDrawer}
          />
        ) : null}
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="safe-pb fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[rgb(6_7_12_/_0.92)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
          <Link
            href="/chat"
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
              pathname.startsWith("/chat")
                ? "text-[#9a6fff]"
                : "text-[var(--text-muted)]",
            )}
          >
            <MessageSquare className="size-5" />
            Chat
          </Link>
          <Link
            href="/home"
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
              pathname === "/home"
                ? "text-[#9a6fff]"
                : "text-[var(--text-muted)]",
            )}
          >
            <Home className="size-5" />
            Home
          </Link>
          <Link
            href="/shifts"
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
              pathname.startsWith("/shifts")
                ? "text-[#9a6fff]"
                : "text-[var(--text-muted)]",
            )}
          >
            <CalendarDays className="size-5" />
            Shifts
          </Link>
          <button
            type="button"
            onClick={toggleDrawer}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
              drawerOpen ? "text-[#9a6fff]" : "text-[var(--text-muted)]",
            )}
          >
            <PanelRightOpen className="size-5" />
            Tools
          </button>
        </div>
      </nav>
    </div>
  );
}

export { ChatFirstShell };
