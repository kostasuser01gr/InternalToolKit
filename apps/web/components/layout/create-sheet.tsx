"use client";

import { Database, MessageSquare, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";

import { PrimaryButton } from "@/components/kit/primary-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CreateSheetProps = {
  triggerClassName?: string;
  compact?: boolean;
};

function CreateSheet({ triggerClassName, compact = false }: CreateSheetProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <PrimaryButton
          className={triggerClassName}
          size={compact ? "icon" : "default"}
          aria-label="Open create menu"
        >
          {compact ? "+" : "Create"}
        </PrimaryButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new workflow asset</DialogTitle>
          <DialogDescription>
            Quick access to the most common internal tool creation flows.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/data"
            className="focus-ring glass-surface rounded-[var(--radius-sm)] p-4 text-sm text-[var(--text)]"
          >
            <div className="mb-2 flex items-center gap-2 text-[var(--text-muted)]">
              <Database className="size-4" />
              New table
            </div>
            Start a schema-backed table for ops records.
          </Link>
          <Link
            href="/automations"
            className="focus-ring glass-surface rounded-[var(--radius-sm)] p-4 text-sm text-[var(--text)]"
          >
            <div className="mb-2 flex items-center gap-2 text-[var(--text-muted)]">
              <Workflow className="size-4" />
              New automation
            </div>
            Define triggers and actions for routine tasks.
          </Link>
          <Link
            href="/assistant"
            className="focus-ring glass-surface rounded-[var(--radius-sm)] p-4 text-sm text-[var(--text)]"
          >
            <div className="mb-2 flex items-center gap-2 text-[var(--text-muted)]">
              <Sparkles className="size-4" />
              Assistant draft
            </div>
            Generate dashboard and automation proposals.
          </Link>
          <Link
            href="/chat"
            className="focus-ring glass-surface rounded-[var(--radius-sm)] p-4 text-sm text-[var(--text)]"
          >
            <div className="mb-2 flex items-center gap-2 text-[var(--text-muted)]">
              <MessageSquare className="size-4" />
              New chat thread
            </div>
            Open a team thread linked to this workspace.
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CreateSheet };
