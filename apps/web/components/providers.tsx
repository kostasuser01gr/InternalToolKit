"use client";

import { ThemeProvider } from "next-themes";

import { ToastProvider } from "@/components/layout/toast-provider";
import { UiPreferencesProvider } from "@/components/layout/ui-preferences-provider";

function Providers({ children }: { children: React.ReactNode }) {
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
