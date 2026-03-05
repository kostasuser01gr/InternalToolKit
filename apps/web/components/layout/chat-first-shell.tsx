"use client";

import {
  Activity,
  Bot,
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
  Shapes,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wallet,
  ShoppingCart,
  Wrench,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

// Polyfill requestIdleCallback for environments that don't support it.
const requestIdleCallback = typeof window !== "undefined" && window.requestIdleCallback
  ? window.requestIdleCallback
  : (cb: () => void) => setTimeout(cb, 1) as unknown as number;
const cancelIdleCallback = typeof window !== "undefined" && window.cancelIdleCallback
  ? window.cancelIdleCallback
  : (id: number) => clearTimeout(id);

declare global {
  interface Window {
    __internalToolkitNavLatency?: Array<{ route: string; ms: number; at: number }>;
  }
}

export type ShellConversation = {
  id: string;
  title: string;
  isPinned?: boolean;
};

export type ShellChannel = {
  id?: string;
  name: string;
};

type ChatFirstShellProps = {
  children: React.ReactNode;
  workspaceName: string;
  userName: string;
  userRole?: string | undefined;
  roleShortcuts?: Record<string, Array<{ id: string; label: string; command: string }>> | undefined;
  opsInboxCount?: number | undefined;
  recentConversations?: ShellConversation[] | undefined;
  workspaceChannels?: ShellChannel[] | undefined;
};

const moduleShortcuts = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/home", label: "Home", icon: Home },
  { href: "/overview", label: "Overview", icon: ChartNoAxesCombined },
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/fleet", label: "Fleet", icon: CarFront },
  { href: "/washers", label: "Washers", icon: Droplets },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/feeds", label: "Feeds", icon: Newspaper },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/data", label: "Data", icon: Database },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/notifications", label: "Notifications", icon: Inbox },
  { href: "/ops-inbox", label: "Ops Inbox", icon: Inbox },
  { href: "/controls", label: "Controls", icon: SlidersHorizontal },
  { href: "/components", label: "Components", icon: Shapes },
  { href: "/work-orders", label: "Work Orders", icon: Wrench },
  { href: "/procurement", label: "Procurement", icon: ShoppingCart },
  { href: "/costs", label: "Costs", icon: Wallet },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const defaultPinnedConversations: ShellConversation[] = [
  { id: "ops-command-center", title: "Ops Command Center", isPinned: true },
  { id: "daily-standup", title: "Daily Standup", isPinned: true },
];

const defaultChannels: ShellChannel[] = [
  { name: "ops-general" },
  { name: "washers-only" },
  { name: "fleet-watch" },
];

function buildChatUrl(input: { threadId?: string; channelId?: string; quickCommand?: string; newConversation?: boolean }) {
  const params = new URLSearchParams();
  if (input.threadId) params.set("threadId", input.threadId);
  if (input.channelId) params.set("channelId", input.channelId);
  if (input.quickCommand) params.set("quickCommand", input.quickCommand);
  if (input.newConversation) params.set("newConversation", "1");
  const query = params.toString();
  return query ? `/chat?${query}` : "/chat";
}

function SidebarContent({
  pathname,
  onNavigate,
  onPrefetchRoute,
  opsInboxCount,
  workspaceName,
  conversations,
  channels,
}: {
  pathname: string;
  onNavigate: () => void;
  onPrefetchRoute: (href: string) => void;
  opsInboxCount?: number | undefined;
  workspaceName: string;
  conversations: ShellConversation[];
  channels: ShellChannel[];
}) {
  const pinned = conversations.filter((item) => item.isPinned).slice(0, 6);
  const recent = conversations.filter((item) => !item.isPinned).slice(0, 10);
  const prefetchHandlers = (href: string) => ({
    onMouseEnter: () => onPrefetchRoute(href),
    onFocus: () => onPrefetchRoute(href),
    onTouchStart: () => onPrefetchRoute(href),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Link
          href={buildChatUrl({ newConversation: true })}
          onClick={onNavigate}
          {...prefetchHandlers(buildChatUrl({ newConversation: true }))}
          className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-[#9a6fff66] bg-[linear-gradient(120deg,rgba(154,111,255,0.28),rgba(115,194,255,0.16))] px-3 py-2.5 text-sm font-semibold text-[var(--text)] shadow-[0_12px_32px_rgba(73,46,140,0.35)]"
        >
          <Plus className="size-4" />
          New conversation
        </Link>
      </div>

      <div className="space-y-3 px-3 pb-3">
        <section className="rounded-2xl border border-[var(--border)] bg-white/4 p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <Pin className="size-3" />
            Pinned
          </p>
          <div className="space-y-0.5">
            {(pinned.length > 0 ? pinned : defaultPinnedConversations).map((conv) => {
              const href = buildChatUrl({ threadId: conv.id });
              return (
                <Link
                  key={conv.id}
                  href={href}
                  onClick={onNavigate}
                  {...prefetchHandlers(href)}
                  className={cn(
                    "focus-ring block truncate rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:bg-white/8 hover:text-[var(--text)]",
                    pathname.startsWith("/chat") && pathname.includes(`threadId=${conv.id}`)
                      ? "bg-[#9a6fff20] text-[var(--text)]"
                      : "",
                  )}
                >
                  {conv.title}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white/4 p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Recent
          </p>
          <div className="space-y-0.5">
            {recent.slice(0, 8).map((conv) => {
              const href = buildChatUrl({ threadId: conv.id });
              return (
                <Link
                  key={conv.id}
                  href={href}
                  onClick={onNavigate}
                  {...prefetchHandlers(href)}
                  className="focus-ring block truncate rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:bg-white/8 hover:text-[var(--text)]"
                >
                  {conv.title}
                </Link>
              );
            })}
            {recent.length === 0 ? (
              <p className="px-2.5 py-1.5 text-xs text-[var(--text-muted)]">No recent threads yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white/4 p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Channels
          </p>
          <div className="space-y-0.5">
            {(channels.length > 0 ? channels : defaultChannels).map((channel, index) => {
              const href = channel.id ? buildChatUrl({ channelId: channel.id }) : "/chat";
              const channelName = channel.name.startsWith("#") ? channel.name : `# ${channel.name}`;
              const active = pathname.startsWith("/chat") && channel.id ? pathname.includes(`channelId=${channel.id}`) : false;
              return (
                <Link
                  key={`${channel.id ?? channel.name}-${index}`}
                  href={href}
                  onClick={onNavigate}
                  {...prefetchHandlers(href)}
                  className={cn(
                    "focus-ring block truncate rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:bg-white/8 hover:text-[var(--text)]",
                    active ? "bg-[#9a6fff20] text-[var(--text)]" : "",
                  )}
                >
                  {channelName}
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Modules
        </p>
        <nav className="space-y-0.5" aria-label="Module navigation">
          {moduleShortcuts.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                {...prefetchHandlers(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                  active
                    ? "bg-[#9a6fff24] text-[var(--text)] shadow-[0_0_20px_rgba(154,111,255,0.16)]"
                    : "text-[var(--text-muted)] hover:bg-white/6 hover:text-[var(--text)]",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
                {href === "/ops-inbox" && opsInboxCount ? (
                  <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold tabular-nums text-rose-300">
                    {opsInboxCount > 99 ? "99+" : opsInboxCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2.5">
        <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {workspaceName}
        </p>
      </div>
    </div>
  );
}

function ChatFirstShell({
  children,
  workspaceName,
  userName,
  userRole,
  roleShortcuts,
  opsInboxCount,
  recentConversations,
  workspaceChannels,
}: ChatFirstShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navIntentRef = useRef<{ route: string; startedAt: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false);

  const conversations = useMemo(
    () => (recentConversations && recentConversations.length > 0 ? recentConversations : defaultPinnedConversations),
    [recentConversations],
  );
  const channels = useMemo(
    () => (workspaceChannels && workspaceChannels.length > 0 ? workspaceChannels : defaultChannels),
    [workspaceChannels],
  );

  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);
  const prefetchRoute = useCallback(
    (route: string) => {
      if (route === pathname) {
        return;
      }
      navIntentRef.current = { route, startedAt: performance.now() };
      router.prefetch(route);
    },
    [pathname, router],
  );

  // Prefetch core routes on idle for instant navigation.
  useEffect(() => {
    const coreRoutes = [
      "/chat",
      "/home",
      "/overview",
      "/dashboard",
      "/ops-inbox",
      "/shifts",
      "/fleet",
      "/washers",
      "/imports",
      "/feeds",
      "/settings",
    ];
    const id = requestIdleCallback(() => {
      for (const route of coreRoutes) {
        prefetchRoute(route);
      }
    });
    return () => cancelIdleCallback(id);
  }, [prefetchRoute]);

  // Dev-only nav latency diagnostics for shell transitions.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const intent = navIntentRef.current;
    if (!intent) {
      return;
    }
    const sample = {
      route: intent.route,
      ms: Math.round(performance.now() - intent.startedAt),
      at: Date.now(),
    };
    const history = window.__internalToolkitNavLatency ?? [];
    window.__internalToolkitNavLatency = [...history.slice(-29), sample];
    navIntentRef.current = null;
  }, [pathname]);

  const openCommandHint = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  }, []);

  const isChatSurface = pathname.startsWith("/chat") || pathname.startsWith("/assistant");

  return (
    <div
      className="app-viewport-min relative flex flex-col bg-[radial-gradient(circle_at_12%_12%,rgba(104,64,184,0.16),transparent_38%),radial-gradient(circle_at_86%_0%,rgba(53,99,193,0.2),transparent_32%),#070913]"
      data-shell-root="true"
      data-chat-first="true"
    >
      <header className="safe-pl safe-pr sticky top-0 z-40 border-b border-[var(--border)] bg-[rgb(6_8_16_/_0.82)] backdrop-blur-2xl">
        <div className="mx-auto flex h-15 max-w-[1900px] items-center gap-2 px-2.5 md:gap-3 md:px-4 lg:px-6">
          <button
            type="button"
            className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white/5 text-[var(--text-muted)] md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <Sparkles className="size-4" />
          </button>

          <button
            type="button"
            className="focus-ring hidden size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white/5 text-[var(--text-muted)] md:inline-flex lg:hidden"
            aria-label="Toggle sidebar"
            onClick={() => setTabletSidebarOpen((v) => !v)}
          >
            <PanelRightOpen className="size-4" />
          </button>

          <Link
            href="/chat"
            onMouseEnter={() => prefetchRoute("/chat")}
            onFocus={() => prefetchRoute("/chat")}
            onTouchStart={() => prefetchRoute("/chat")}
            className="flex min-w-0 shrink-0 items-center gap-2"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#9a6fff] via-[#7b82ff] to-[#5ed0ff] text-[11px] font-bold text-white shadow-[0_0_28px_rgba(122,105,255,0.45)]">
              IO
            </span>
            <span className="hidden max-w-36 truncate text-sm font-semibold text-[var(--text)] lg:inline">
              {workspaceName}
            </span>
          </Link>

          <form action="/chat" className="relative min-w-0 flex-1 xl:max-w-[760px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              name="quickCommand"
              placeholder="Search or ask anything..."
              className="focus-ring h-10 w-full rounded-2xl border border-[var(--border)] bg-white/8 pl-9 pr-18 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={openCommandHint}
              className="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg border border-[var(--border)] bg-black/20 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--text-muted)] uppercase"
              aria-label="Keyboard shortcut hint"
            >
              Ctrl+K
            </button>
          </form>

          <div className="hidden xl:block">
            <QuickBar userRole={userRole} roleShortcuts={roleShortcuts} />
          </div>

          <div className="relative z-20 flex shrink-0 items-center gap-1.5">
            <CommandPalette />
            <CreateSheet triggerClassName="hidden sm:inline-flex" />
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
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/6 py-1 pl-1 pr-2.5 text-sm"
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-16 shrink-0 border-r border-[var(--border)] bg-[rgb(8_10_19_/_0.78)] md:flex lg:hidden">
          <div className="flex w-full flex-col items-center gap-2 px-2 py-3">
            <button
              type="button"
              className="focus-ring inline-flex size-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white/7 text-[var(--text-muted)]"
              aria-label="Expand sidebar"
              onClick={() => setTabletSidebarOpen((v) => !v)}
            >
              <PanelRightOpen className="size-4" />
            </button>
            <Link
              href={buildChatUrl({ newConversation: true })}
              onMouseEnter={() => prefetchRoute(buildChatUrl({ newConversation: true }))}
              onFocus={() => prefetchRoute(buildChatUrl({ newConversation: true }))}
              onTouchStart={() => prefetchRoute(buildChatUrl({ newConversation: true }))}
              className="focus-ring inline-flex size-10 items-center justify-center rounded-xl border border-[#9a6fff66] bg-[#9a6fff2a] text-[#c9b7ff]"
            >
              <Plus className="size-4" />
            </Link>
            <div className="mt-1 h-px w-full bg-[var(--border)]" />
            {moduleShortcuts.slice(0, 10).map(({ href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onMouseEnter={() => prefetchRoute(href)}
                  onFocus={() => prefetchRoute(href)}
                  onTouchStart={() => prefetchRoute(href)}
                  className={cn(
                    "focus-ring inline-flex size-10 items-center justify-center rounded-xl text-[var(--text-muted)]",
                    active ? "bg-[#9a6fff26] text-[var(--text)]" : "hover:bg-white/7 hover:text-[var(--text)]",
                  )}
                  aria-label={href}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
          </div>
        </aside>

        <aside
          className={cn(
            "hidden w-[300px] shrink-0 border-r border-[var(--border)] bg-[rgb(8_10_19_/_0.72)] backdrop-blur-2xl",
            "lg:block",
            tabletSidebarOpen ? "md:block" : "md:hidden",
          )}
        >
          <SidebarContent
            pathname={pathname}
            onNavigate={() => setTabletSidebarOpen(false)}
            onPrefetchRoute={prefetchRoute}
            opsInboxCount={opsInboxCount}
            workspaceName={workspaceName}
            conversations={conversations}
            channels={channels}
          />
        </aside>

        <aside
          className={cn(
            "fixed inset-y-15 left-0 z-40 w-[86vw] max-w-[320px] border-r border-[var(--border)] bg-[rgb(8_10_19_/_0.94)] backdrop-blur-2xl transition-transform duration-200 md:hidden",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarContent
            pathname={pathname}
            onNavigate={() => setMobileMenuOpen(false)}
            onPrefetchRoute={prefetchRoute}
            opsInboxCount={opsInboxCount}
            workspaceName={workspaceName}
            conversations={conversations}
            channels={channels}
          />
        </aside>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-30 bg-black/55 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        ) : null}

        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "mx-auto w-full px-3 pb-24 pt-4 md:px-5 md:pb-8 lg:px-8 lg:pt-6",
              isChatSurface ? "max-w-[1120px]" : "max-w-[1600px]",
            )}
          >
            {children}
          </div>
          <UndoToast />
        </main>

        <aside
          className={cn(
            "border-l border-[var(--border)] bg-[rgb(8_10_19_/_0.72)] transition-[width,transform] duration-200 overflow-y-auto backdrop-blur-2xl",
            "max-lg:fixed max-lg:inset-y-15 max-lg:right-0 max-lg:z-40 max-lg:w-[320px]",
            drawerOpen ? "w-[320px] max-lg:translate-x-0" : "w-0 max-lg:translate-x-full",
          )}
        >
          {drawerOpen ? (
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text)]">Control Tower</h2>
                <button
                  type="button"
                  onClick={toggleDrawer}
                  className="focus-ring inline-flex size-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)]"
                  aria-label="Close drawer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/shifts" onMouseEnter={() => prefetchRoute("/shifts")} onFocus={() => prefetchRoute("/shifts")} onTouchStart={() => prefetchRoute("/shifts")} className="focus-ring rounded-xl border border-[var(--border)] bg-white/6 p-3 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text)]">New Shift</Link>
                  <Link href="/fleet" onMouseEnter={() => prefetchRoute("/fleet")} onFocus={() => prefetchRoute("/fleet")} onTouchStart={() => prefetchRoute("/fleet")} className="focus-ring rounded-xl border border-[var(--border)] bg-white/6 p-3 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Fleet Event</Link>
                  <Link href="/work-orders" onMouseEnter={() => prefetchRoute("/work-orders")} onFocus={() => prefetchRoute("/work-orders")} onTouchStart={() => prefetchRoute("/work-orders")} className="focus-ring rounded-xl border border-[var(--border)] bg-white/6 p-3 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Work Order</Link>
                  <Link href="/reports" onMouseEnter={() => prefetchRoute("/reports")} onFocus={() => prefetchRoute("/reports")} onTouchStart={() => prefetchRoute("/reports")} className="focus-ring rounded-xl border border-[var(--border)] bg-white/6 p-3 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Report</Link>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Status</p>
                <div className="space-y-1 rounded-xl border border-[var(--border)] bg-white/6 p-3 text-xs text-[var(--text-muted)]">
                  <div className="flex justify-between"><span>Database</span><span className="text-emerald-400">Connected</span></div>
                  <div className="flex justify-between"><span>API</span><span className="text-emerald-400">Healthy</span></div>
                  <div className="flex justify-between"><span>Ops Inbox</span><span className="text-[var(--text)]">{opsInboxCount ?? 0}</span></div>
                </div>
              </section>
            </div>
          ) : null}
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-30 bg-black/45 lg:hidden" onClick={toggleDrawer} />
        ) : null}
      </div>

      <nav
        data-testid="bottom-nav"
        className="safe-pb fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[rgb(7_9_16_/_0.95)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
          <Link
            href="/chat"
            onMouseEnter={() => prefetchRoute("/chat")}
            onFocus={() => prefetchRoute("/chat")}
            onTouchStart={() => prefetchRoute("/chat")}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
              pathname.startsWith("/chat") ? "text-[#9a6fff]" : "text-[var(--text-muted)]",
            )}
          >
            <MessageSquare className="size-5" />
            Chat
          </Link>
          <Link
            href="/dashboard"
            onMouseEnter={() => prefetchRoute("/dashboard")}
            onFocus={() => prefetchRoute("/dashboard")}
            onTouchStart={() => prefetchRoute("/dashboard")}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
              pathname.startsWith("/dashboard") ? "text-[#9a6fff]" : "text-[var(--text-muted)]",
            )}
          >
            <ChartNoAxesCombined className="size-5" />
            Dash
          </Link>
          <Link
            href="/fleet"
            onMouseEnter={() => prefetchRoute("/fleet")}
            onFocus={() => prefetchRoute("/fleet")}
            onTouchStart={() => prefetchRoute("/fleet")}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
              pathname.startsWith("/fleet") ? "text-[#9a6fff]" : "text-[var(--text-muted)]",
            )}
          >
            <CarFront className="size-5" />
            Fleet
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] text-[var(--text-muted)]"
            aria-label="Open modules"
          >
            <Sparkles className="size-5" />
            Menu
          </button>
        </div>
      </nav>
    </div>
  );
}

export { ChatFirstShell };
