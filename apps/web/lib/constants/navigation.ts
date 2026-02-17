import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  Database,
  FileText,
  Home,
  LayoutPanelTop,
  MessageSquare,
  Plus,
  Shapes,
  SlidersHorizontal,
  Settings,
  Workflow,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const sidebarNavItems: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/overview", label: "Overview", icon: LayoutPanelTop },
  { href: "/data", label: "Data", icon: Database },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/controls", label: "Controls", icon: SlidersHorizontal },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/components", label: "Components", icon: Shapes },
  { href: "/settings", label: "Settings", icon: Settings },
];

export type MobileNavItem =
  | {
      type: "route";
      href: string;
      label: string;
      icon: LucideIcon;
    }
  | {
      type: "action";
      actionId: "create";
      label: string;
      icon: LucideIcon;
    };

export const mobileNavItems: MobileNavItem[] = [
  { type: "route", href: "/home", label: "Home", icon: Home },
  { type: "route", href: "/assistant", label: "AI Assistant", icon: Bot },
  { type: "action", actionId: "create", label: "Create", icon: Plus },
  { type: "route", href: "/chat", label: "Chat", icon: MessageSquare },
  {
    type: "route",
    href: "/analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
  },
];
