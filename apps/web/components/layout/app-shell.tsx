"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { ChatFirstShell } from "@/components/layout/chat-first-shell";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { SideRail } from "@/components/layout/side-rail";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { features } from "@/lib/constants/features";
import { sidebarNavItems } from "@/lib/constants/navigation";

type AppShellProps = {
  children: React.ReactNode;
  workspaceName: string;
  userName: string;
  userRole?: string | undefined;
};

function AppShell({ children, workspaceName, userName, userRole }: AppShellProps) {
  const pathname = usePathname();

  if (features.chatFirstUi) {
    return (
      <ChatFirstShell
        workspaceName={workspaceName}
        userName={userName}
        userRole={userRole}
      >
        {children}
      </ChatFirstShell>
    );
  }

  const activeTitle =
    sidebarNavItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? "Dashboard";

  return (
    <div className="app-viewport-min relative" data-shell-root="true">
      <OfflineBanner />

      <a
        href="#main-content"
        className="focus-ring sr-only absolute top-2 left-2 z-50 rounded-md bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] focus:not-sr-only"
      >
        Skip to content
      </a>

      <div className="app-viewport-min mx-auto flex max-w-[1800px]">
        <Sidebar workspaceName={workspaceName} />
        <SideRail />

        <div className="app-viewport-min flex min-w-0 flex-1 flex-col">
          <header
            data-testid="mobile-header"
            className="safe-pt safe-pl safe-pr sticky top-0 z-30 border-b border-[var(--border)] bg-[rgb(6_7_12_/_0.76)] backdrop-blur-xl md:block lg:hidden"
          >
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-2">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--text-muted)] uppercase">
                  Workspace
                </p>
                <p className="kpi-font text-lg font-semibold text-[var(--text)]">
                  {activeTitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="focus-ring inline-flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-white/5 text-[var(--text-muted)]"
                  aria-label="Search"
                >
                  <Search className="size-4" aria-hidden="true" />
                </button>
                <Link
                  href="/notifications"
                  className="focus-ring inline-flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-white/5 text-[var(--text-muted)]"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </header>

          <TopBar workspaceName={workspaceName} userName={userName} />

          <main
            id="main-content"
            className="safe-pl safe-pr flex-1 px-4 pt-5 pb-28 md:px-6 lg:px-8 lg:pb-8"
          >
            <div className="mx-auto max-w-[1500px]">{children}</div>
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export { AppShell };
