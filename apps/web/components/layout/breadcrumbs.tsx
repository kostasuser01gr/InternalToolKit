"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const segmentLabels: Record<string, string> = {
  home: "Home",
  overview: "Overview",
  dashboard: "Dashboard",
  data: "Data",
  automations: "Automations",
  assistant: "Assistant",
  chat: "Chat",
  analytics: "Analytics",
  controls: "Controls",
  activity: "Activity",
  reports: "Reports",
  components: "Components",
  settings: "Settings",
  notifications: "Notifications",
  admin: "Admin",
};

type BreadcrumbsProps = {
  className?: string;
};

function Breadcrumbs({ className }: BreadcrumbsProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label =
      segmentLabels[segment] ??
      segment.replaceAll("-", " ").replace(/\b\w/g, (match) => match.toUpperCase());

    return {
      href,
      label,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-xs text-[var(--text-muted)]", className)}
    >
      {crumbs.map((crumb) => (
        <div key={crumb.href} className="flex items-center gap-1">
          {crumb.isLast ? (
            <span aria-current="page" className="text-[var(--text)]">
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="focus-ring rounded px-1 py-0.5 hover:text-[var(--text)]">
              {crumb.label}
            </Link>
          )}
          {!crumb.isLast ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
        </div>
      ))}
    </nav>
  );
}

export { Breadcrumbs };
