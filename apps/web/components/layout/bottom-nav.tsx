"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CreateSheet } from "@/components/layout/create-sheet";
import { mobileNavItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Mobile primary navigation"
      className="safe-pb safe-pl safe-pr fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      <div className="glass-surface mx-auto grid max-w-xl grid-cols-5 items-center gap-1 rounded-[var(--radius-lg)] px-2 py-2">
        {mobileNavItems.map((item) => {
          if (item.type === "action") {
            return (
              <div
                key={item.actionId}
                className="flex flex-col items-center justify-center gap-1"
              >
                <CreateSheet
                  triggerClassName="size-12 rounded-full p-0"
                  compact
                />
                <span className="text-[11px] text-[var(--text-muted)]">
                  {item.label}
                </span>
              </div>
            );
          }

          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] py-2 text-[11px] text-[var(--text-muted)]",
                active &&
                  "bg-[#9a6fff22] text-[var(--text)] shadow-[var(--glow-shadow)]",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { BottomNav };
