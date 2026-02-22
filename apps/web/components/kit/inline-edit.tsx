"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type InlineEditProps = {
  value: string;
  onSave: (newValue: string) => void | Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Show optimistic value immediately while saving */
  optimistic?: boolean;
};

export function InlineEdit({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  disabled = false,
  optimistic = true,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(value);
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = useCallback(async () => {
    if (editValue === value) {
      setEditing(false);
      return;
    }
    if (optimistic) setDisplayValue(editValue);
    setSaving(true);
    try {
      await onSave(editValue);
      setEditing(false);
    } catch {
      // revert optimistic update
      setDisplayValue(value);
      setEditValue(value);
    } finally {
      setSaving(false);
    }
  }, [editValue, value, onSave, optimistic]);

  const cancel = useCallback(() => {
    setEditValue(value);
    setDisplayValue(value);
    setEditing(false);
  }, [value]);

  if (disabled || !editing) {
    return (
      <span
        className={cn(
          "inline-block cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-white/10",
          disabled && "cursor-default opacity-60",
          className,
        )}
        onClick={disabled ? undefined : () => setEditing(true)}
        title={disabled ? undefined : "Click to edit"}
      >
        {displayValue || <span className="text-[var(--text-muted)]">{placeholder ?? "—"}</span>}
        {saving ? <span className="ml-1 text-xs text-[var(--text-muted)]">…</span> : null}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
      }}
      className={cn(
        "inline-block rounded border border-[var(--accent)]/50 bg-white/10 px-1 py-0.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]",
        inputClassName,
      )}
      placeholder={placeholder}
    />
  );
}

// ── Undo Stack ──

type UndoEntry = {
  id: string;
  label: string;
  undo: () => void | Promise<void>;
  expiresAt: number;
};

const undoStack: UndoEntry[] = [];
const UNDO_TTL_MS = 15_000; // 15 seconds

export function pushUndo(entry: Omit<UndoEntry, "expiresAt">) {
  undoStack.push({ ...entry, expiresAt: Date.now() + UNDO_TTL_MS });
  // Prune expired
  const now = Date.now();
  while (undoStack.length > 0 && undoStack[0]!.expiresAt < now) {
    undoStack.shift();
  }
}

export function popUndo(): UndoEntry | undefined {
  const now = Date.now();
  while (undoStack.length > 0) {
    const entry = undoStack.pop()!;
    if (entry.expiresAt >= now) return entry;
  }
  return undefined;
}

export function getUndoCount(): number {
  const now = Date.now();
  return undoStack.filter((e) => e.expiresAt >= now).length;
}
