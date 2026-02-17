"use client";

import { FileType2 } from "lucide-react";

import { useToast } from "@/components/layout/toast-provider";
import { logClientActivity } from "@/lib/activity/client";

function PdfPlaceholderButton() {
  const { toast } = useToast();

  return (
    <button
      type="button"
      onClick={async () => {
        toast({
          title: "PDF placeholder executed.",
          description: "Hook this action to your document service adapter.",
          tone: "info",
        });
        await logClientActivity({
          action: "reports.pdf_placeholder_triggered",
          entityType: "report_export",
          entityId: "pdf_placeholder",
          meta: {},
        });
      }}
      className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/8 px-3 py-2 text-sm text-[var(--text)]"
      aria-label="Generate PDF placeholder"
    >
      <FileType2 className="size-4" />
      Generate PDF (placeholder)
    </button>
  );
}

export { PdfPlaceholderButton };
