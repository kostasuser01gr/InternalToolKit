"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { useToast } from "@/components/layout/toast-provider";
import { logClientActivity } from "@/lib/activity/client";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = theme !== "light";

  return (
    <ToggleSwitch
      id="theme-toggle"
      label="Dark mode"
      description="Switch between dark and light surfaces"
      checked={mounted ? isDark : true}
      onCheckedChange={async (checked) => {
        setTheme(checked ? "dark" : "light");
        toast({
          title: checked ? "Dark theme enabled." : "Light theme enabled.",
          tone: "info",
        });
        await logClientActivity({
          action: "ui.theme_toggled",
          entityType: "ui_preference",
          entityId: "theme",
          meta: { theme: checked ? "dark" : "light" },
        });
      }}
    />
  );
}

export { ThemeToggle };
