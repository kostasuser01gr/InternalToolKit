import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Washer Kiosk",
  description: "Quick vehicle wash task registration kiosk.",
};

export default function KioskLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="kiosk-root flex min-h-dvh flex-col bg-[var(--bg)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-[var(--text)]">
            🧽 Washer Kiosk
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span id="kiosk-sync-status">●&nbsp;Online</span>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
