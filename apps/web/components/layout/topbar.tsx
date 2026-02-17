"use client";

import { Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CommandPalette } from "@/components/layout/command-palette";
import { CreateSheet } from "@/components/layout/create-sheet";
import { SearchBar } from "@/components/layout/search-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutSession } from "@/lib/auth/client";
import { features } from "@/lib/constants/features";

type TopBarProps = {
  workspaceName: string;
  userName: string;
};

function TopBar({ workspaceName, userName }: TopBarProps) {
  const router = useRouter();

  return (
    <header
      data-testid="topbar"
      className={`safe-pl safe-pr sticky top-0 z-30 hidden border-b border-[var(--border)] bg-[rgb(6_7_12_/_0.75)] backdrop-blur-xl lg:block ${features.windowControlsOverlay ? "wco-safe-top" : ""}`}
    >
      <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between gap-4 px-6 xl:px-8">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.22em] text-[var(--text-muted)] uppercase">
            Internal Tools
          </p>
          <p className="kpi-font text-lg font-semibold text-[var(--text)]">
            {workspaceName}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <SearchBar className="max-w-md" />
          <CommandPalette />
          <CreateSheet />
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="focus-ring inline-flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-white/5 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <Bell className="size-4" aria-hidden="true" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/6 px-3 py-2 text-sm"
                aria-label="Profile menu"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#9a6fff2b] text-xs font-semibold text-[var(--text)]">
                  {userName.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden max-w-28 truncate text-[var(--text-muted)] xl:inline">
                  {userName}
                </span>
                <ChevronDown className="size-4 text-[var(--text-muted)]" />
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
              <DropdownMenuItem asChild>
                <a href="/overview" className="cursor-pointer">
                  <User className="size-4" />
                  Overview
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
  );
}

export { TopBar };
