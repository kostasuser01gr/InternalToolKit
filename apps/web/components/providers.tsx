"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import { ToastProvider } from "@/components/layout/toast-provider";
import { UiPreferencesProvider } from "@/components/layout/ui-preferences-provider";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

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

  const inner = (
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

  if (convex) {
    return <ConvexProvider client={convex}>{inner}</ConvexProvider>;
  }
  return inner;
}

export { Providers };
