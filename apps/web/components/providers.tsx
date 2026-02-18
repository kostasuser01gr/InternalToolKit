"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";

import { ToastProvider } from "@/components/layout/toast-provider";
import { UiPreferencesProvider } from "@/components/layout/ui-preferences-provider";

function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <UiPreferencesProvider>
        <ToastProvider>{children}</ToastProvider>
      </UiPreferencesProvider>
    </ThemeProvider>
  );
}

export { Providers };
