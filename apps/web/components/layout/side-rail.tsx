"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { features } from "@/lib/constants/features";
import { sidebarNavItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

function SideRail() {
  const pathname = usePathname();

  return (
    <aside
      data-testid="side-rail"
      className="safe-pt safe-pb app-viewport hidden w-20 shrink-0 px-2 py-4 md:block xl:hidden"
    >
      <div className="glass-surface flex h-full flex-col items-center gap-2 overflow-y-auto rounded-[var(--radius-lg)] py-4">
        {sidebarNavItems
          .filter(
            (item) => item.href !== "/components" || features.componentsShowroom,
          )
          .map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--text-muted)]",
                active
                  ? "border-[#9a6fff66] bg-[#9a6fff24] text-[var(--text)] shadow-[var(--glow-shadow)]"
                  : "hover:border-[var(--border)] hover:bg-white/7 hover:text-[var(--text)]",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </Link>
          );
          })}
      </div>
    </aside>
  );
}

export { SideRail };
