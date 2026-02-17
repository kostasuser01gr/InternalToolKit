"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string | undefined;
  tone?: ToastTone;
};

type ToastRecord = ToastInput & {
  id: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast(input: ToastInput): void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toneIcon(tone: ToastTone) {
  if (tone === "success") {
    return <CheckCircle2 className="size-4" aria-hidden="true" />;
  }

  if (tone === "error") {
    return <AlertTriangle className="size-4" aria-hidden="true" />;
  }

  return <Info className="size-4" aria-hidden="true" />;
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const tone = input.tone ?? "info";
      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        tone,
      };

      setToasts((current) => [record, ...current].slice(0, 5));
      window.setTimeout(() => remove(id), 3800);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="safe-pt safe-pr fixed top-0 right-0 z-[120] flex w-full max-w-sm flex-col gap-2 p-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "glass-surface rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
              item.tone === "success" && "border-emerald-300/30 bg-emerald-300/10",
              item.tone === "error" && "border-rose-300/30 bg-rose-300/10",
              item.tone === "info" && "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              {toneIcon(item.tone)}
              <p className="font-medium text-[var(--text)]">{item.title}</p>
            </div>
            {item.description ? (
              <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}

export { ToastProvider, useToast };
