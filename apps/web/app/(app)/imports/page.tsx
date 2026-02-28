import { Suspense } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, RotateCcw, Clock, AlertTriangle } from "lucide-react";

import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { GlassCard } from "@/components/kit/glass-card";
import { FormSubmitButton } from "@/components/kit/form-submit-button";
import { Badge } from "@/components/ui/badge";
import {
  acceptImportAction,
  declineImportAction,
  rollbackImportAction,
  uploadImportAction,
} from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "success" | "active" | "danger"; label: string }> = {
    UPLOADING: { variant: "default", label: "Uploading" },
    ANALYZING: { variant: "active", label: "Analyzing" },
    PREVIEW: { variant: "active", label: "Preview" },
    ACCEPTED: { variant: "success", label: "Accepted" },
    DECLINED: { variant: "danger", label: "Declined" },
    APPLYING: { variant: "active", label: "Applying…" },
    APPLIED: { variant: "success", label: "Applied" },
    ROLLED_BACK: { variant: "default", label: "Rolled Back" },
    FAILED: { variant: "danger", label: "Failed" },
  };
  const m = map[status] ?? { variant: "default" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function ImportUploadCard({ workspaceId }: { workspaceId: string }) {
  return (
    <GlassCard className="p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Upload className="h-5 w-5" /> Import Data
      </h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Upload XLSX, CSV, or JSON files to import bookings, vehicles, or other data.
        AI will analyze the file and propose a mapping.
      </p>
      <form action={uploadImportAction} className="space-y-4">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center transition-colors hover:border-[var(--accent)]">
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
          <label className="cursor-pointer">
            <span className="text-sm font-medium text-[var(--accent)]">Choose file</span>
            <input
              type="file"
              name="file"
              accept=".xlsx,.csv,.json,.txt"
              className="sr-only"
            />
          </label>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            XLSX, CSV, JSON, or TXT — max 10MB
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Type:</label>
          <select
            name="importType"
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
          >
            <option value="bookings">Bookings</option>
            <option value="vehicles">Vehicles</option>
            <option value="staff">Staff</option>
            <option value="other">Other</option>
          </select>
        </div>
        <FormSubmitButton
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          pendingText="Uploading..."
        >
          Upload &amp; Analyze
        </FormSubmitButton>
      </form>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Files are analyzed with AI to propose column mappings. You review and accept/decline before any changes are applied.
      </p>
    </GlassCard>
  );
}

type DiffSummaryData = {
  totalRows?: number;
  creates?: number;
  updates?: number;
  archives?: number;
  skips?: number;
  errors?: number;
};

type PreviewData = {
  rowCount?: number;
  headers?: string[];
  parseErrors?: string[];
  sheetName?: string;
};

type Batch = {
  id: string;
  status: string;
  importType: string;
  fileName: string;
  fileSizeBytes: number | null;
  createdAt: Date;
  appliedAt: Date | null;
  diffSummary: DiffSummaryData | null;
  previewJson: PreviewData | null;
  errorLog: string | null;
  creator: { name: string | null; email: string | null } | null;
};

function BatchCard({ batch, workspaceId }: { batch: Batch; workspaceId: string }) {
  const sizeLabel = batch.fileSizeBytes
    ? batch.fileSizeBytes > 1048576
      ? `${(batch.fileSizeBytes / 1048576).toFixed(1)} MB`
      : `${Math.round(batch.fileSizeBytes / 1024)} KB`
    : null;

  const diff = batch.diffSummary as DiffSummaryData | null;
  const preview = batch.previewJson as PreviewData | null;

  return (
    <GlassCard className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{batch.fileName}</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {batch.importType} · {sizeLabel ?? "unknown size"} · by {batch.creator?.name ?? batch.creator?.email ?? "unknown"}
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      {/* Parsed data summary */}
      {preview?.rowCount != null && (
        <div className="rounded-md bg-white/5 px-3 py-2 text-xs">
          <span className="font-medium">{preview.rowCount} rows parsed</span>
          {preview.sheetName && <span className="text-[var(--text-muted)]"> · sheet: {preview.sheetName}</span>}
          {preview.parseErrors && preview.parseErrors.length > 0 && (
            <span className="ml-2 text-amber-400">⚠ {preview.parseErrors.length} parse warning(s)</span>
          )}
        </div>
      )}

      {/* Diff preview */}
      {diff && (diff.creates != null || diff.updates != null) && (
        <div className="flex flex-wrap gap-3 rounded-md border border-[var(--border)] bg-white/5 px-3 py-2 text-xs">
          <span className="font-medium text-[var(--text-muted)]">Preview:</span>
          {!!diff.creates && <span className="text-emerald-400">+{diff.creates} create</span>}
          {!!diff.updates && <span className="text-sky-400">~{diff.updates} update</span>}
          {!!diff.skips && <span className="text-[var(--text-muted)]">{diff.skips} unchanged</span>}
          {!!diff.errors && <span className="text-rose-400">{diff.errors} error(s)</span>}
        </div>
      )}

      {batch.errorLog && (
        <div className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {batch.errorLog}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Clock className="h-3 w-3" />
        <span>{batch.createdAt.toLocaleString()}</span>
        {batch.appliedAt && (
          <>
            <CheckCircle className="ml-2 h-3 w-3 text-emerald-400" />
            <span>Applied {batch.appliedAt.toLocaleString()}</span>
          </>
        )}
      </div>
      {/* Actions based on status */}
      <div className="flex items-center gap-2">
        {batch.status === "PREVIEW" && (
          <>
            <form action={acceptImportAction}>
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="batchId" value={batch.id} />
              <FormSubmitButton
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                pendingText="Accepting…"
              >
                <CheckCircle className="h-3 w-3" /> Accept
              </FormSubmitButton>
            </form>
            <form action={declineImportAction}>
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="batchId" value={batch.id} />
              <FormSubmitButton
                className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                pendingText="Declining…"
              >
                <XCircle className="h-3 w-3" /> Decline
              </FormSubmitButton>
            </form>
          </>
        )}
        {batch.status === "APPLIED" && (
          <form action={rollbackImportAction}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="batchId" value={batch.id} />
            <FormSubmitButton
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-white/5"
              pendingText="Rolling back…"
            >
              <RotateCcw className="h-3 w-3" /> Rollback
            </FormSubmitButton>
          </form>
        )}
      </div>
    </GlassCard>
  );
}

async function ImportBatchList({ workspaceId }: { workspaceId: string }) {
  let batches: Batch[];
  try {
    batches = await db.importBatch.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { creator: { select: { name: true, email: true } } },
      // diffSummary, previewJson, errorLog included by default
    }) as unknown as Batch[];
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return (
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Imports module is not yet available. Migrations may be pending.</span>
          </div>
        </GlassCard>
      );
    }
    throw err;
  }

  if (batches.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">No imports yet. Upload a file to get started.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} workspaceId={workspaceId} />
      ))}
    </div>
  );
}

export default async function ImportsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const { workspace } = await getAppContext();

  const error = typeof searchParams.error === "string" ? searchParams.error : null;
  const success = typeof searchParams.success === "string" ? searchParams.success : null;

  return (
    <div data-testid="imports-page" className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Imports</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Upload data files, review AI-proposed mappings, and apply or decline changes.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <ImportUploadCard workspaceId={workspace.id} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Imports</h2>
        <Suspense fallback={<div className="animate-pulse rounded-lg bg-white/5 p-8" />}>
          <ImportBatchList workspaceId={workspace.id} />
        </Suspense>
      </div>
    </div>
  );
}
