import type { Prisma } from "@prisma/client";

import { getAssistantProvider } from "@/lib/assistant/provider";

export async function summarizeRecords(
  records: Array<{ dataJson: Prisma.JsonValue }>,
  filterText?: string,
  options?: {
    totalMatchingRecords?: number;
  },
) {
  const provider = getAssistantProvider();
  const totalMatchingRecords = options?.totalMatchingRecords ?? records.length;
  const sampled = totalMatchingRecords > records.length;

  const prompt = `Summarize ${
    sampled
      ? `${records.length} sampled records (out of ${totalMatchingRecords} matching)`
      : `${records.length} records`
  }${
    filterText ? ` filtered by: ${filterText}` : ""
  }.`;

  return provider.generate({
    type: "summarize_table",
    prompt,
    context: {
      sample: records.slice(0, 4).map((record) => record.dataJson),
    },
  });
}

export async function generateAutomationDraft(prompt: string) {
  const provider = getAssistantProvider();

  return provider.generate({
    type: "automation_draft",
    prompt,
  });
}

export async function generateKpiLayoutSuggestion(objective: string) {
  const provider = getAssistantProvider();

  return provider.generate({
    type: "kpi_layout",
    prompt: objective,
  });
}
