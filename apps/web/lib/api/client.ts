import {
  aiChatRequestSchema,
  aiChatResponseSchema,
  aiUsageResponseSchema,
  assistantDraftRequestSchema,
  assistantDraftResponseSchema,
  auditCreatedResponseSchema,
  auditEventInputSchema,
  healthResponseSchema,
  type AiChatResponse,
  type AiUsageResponse,
  type AssistantDraftResponse,
  type AuditCreatedResponse,
  type AuditEventInput,
  type HealthResponse,
} from "@internal-toolkit/shared";

const defaultApiUrl = "http://127.0.0.1:8787";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || defaultApiUrl;
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const payload = await requestJson("/health", {
      signal: AbortSignal.timeout(1500),
    });

    if (!payload) {
      return null;
    }

    return healthResponseSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function createAuditEvent(
  input: AuditEventInput,
): Promise<AuditCreatedResponse | null> {
  try {
    const payload = await requestJson("/v1/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(auditEventInputSchema.parse(input)),
      signal: AbortSignal.timeout(3000),
    });

    if (!payload) {
      return null;
    }

    return auditCreatedResponseSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function draftAutomation(
  prompt: string,
): Promise<AssistantDraftResponse | null> {
  try {
    const payload = await requestJson("/v1/assistant/draft-automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assistantDraftRequestSchema.parse({ prompt })),
      signal: AbortSignal.timeout(3000),
    });

    if (!payload) {
      return null;
    }

    return assistantDraftResponseSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function chatWithCloudAi(
  prompt: string,
): Promise<AiChatResponse | null> {
  try {
    const payload = await requestJson("/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiChatRequestSchema.parse({ prompt })),
      signal: AbortSignal.timeout(6000),
    });

    if (!payload) {
      return null;
    }

    return aiChatResponseSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function fetchCloudAiUsage(): Promise<AiUsageResponse | null> {
  try {
    const payload = await requestJson("/v1/ai/usage", {
      signal: AbortSignal.timeout(1500),
    });

    if (!payload) {
      return null;
    }

    return aiUsageResponseSchema.parse(payload);
  } catch {
    return null;
  }
}
