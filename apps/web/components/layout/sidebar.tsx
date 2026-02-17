"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { features } from "@/lib/constants/features";
import { sidebarNavItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  workspaceName: string;
};

function Sidebar({ workspaceName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      data-testid="sidebar"
      className="safe-pt safe-pb app-viewport hidden w-72 shrink-0 px-4 py-4 xl:block"
    >
      <div className="glass-surface flex h-full flex-col rounded-[var(--radius-lg)] px-4 py-5">
        <div className="mb-8 px-2">
          <p className="text-xs tracking-[0.2em] text-[var(--text-muted)] uppercase">
            Workspace
          </p>
          <p className="kpi-font mt-1 text-xl font-semibold text-[var(--text)]">
            {workspaceName}
          </p>
        </div>

        <nav
          aria-label="Primary navigation"
          className="space-y-2 overflow-y-auto pr-1"
        >
          {sidebarNavItems
            .filter(
              (item) =>
                item.href !== "/components" || features.componentsShowroom,
            )
            .map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-3 text-sm text-[var(--text-muted)]",
                  active
                    ? "border-[#9a6fff66] bg-[#9a6fff24] text-[var(--text)] shadow-[var(--glow-shadow)]"
                    : "hover:border-[var(--border)] hover:bg-white/7 hover:text-[var(--text)]",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
            })}
        </nav>

        <div className="mt-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 text-xs text-[var(--text-muted)]">
          Programmable internal tools with auditable actions and role-safe
          workflows.
        </div>
      </div>
    </aside>
  );
}

export { Sidebar };
