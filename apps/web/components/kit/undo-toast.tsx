"use client";

import { useCallback, useEffect, useState } from "react";
import { Undo2 } from "lucide-react";

import { getUndoCount, popUndo } from "@/components/kit/inline-edit";
import { cn } from "@/lib/utils";

/** Floating undo toast — shows when undo entries are available */
export function UndoToast() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState("");

  // Poll for undo entries (lightweight)
  useEffect(() => {
    const interval = setInterval(() => {
      const count = getUndoCount();
      setVisible(count > 0);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUndo = useCallback(async () => {
    const entry = popUndo();
    if (entry) {
      setLabel(`Undone: ${entry.label}`);
      await entry.undo();
      setTimeout(() => setLabel(""), 2000);
    }
  }, []);

  if (!visible && !label) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[rgb(15_16_22)] px-3 py-2 text-sm text-[var(--text)] shadow-lg backdrop-blur-xl transition-all",
        !visible && label && "pointer-events-none opacity-70",
      )}
    >
      {label ? (
        <span className="text-emerald-400">{label}</span>
      ) : (
        <button onClick={handleUndo} className="flex items-center gap-1.5 text-[var(--accent)] hover:underline">
          <Undo2 className="size-4" />
          Undo
        </button>
      )}
    </div>
  );
}
