import { aiChatResponseSchema, type AiChatTask } from "@internal-toolkit/shared";

import { getServerEnv } from "@/lib/env";
import {
  routeRequest,
  type RouterMode,
  type RouterTelemetry,
} from "./router";

export type AssistantTask = {
  type: "summarize_table" | "automation_draft" | "kpi_layout";
  prompt: string;
  context?: Record<string, unknown>;
};

export type AssistantResult = {
  provider: string;
  content: string;
  routerTelemetry?: RouterTelemetry;
};

export interface ProviderAdapter {
  readonly id: string;
  readonly enabled: boolean;
  generate(task: AssistantTask): Promise<AssistantResult>;
}

class MockLocalProvider implements ProviderAdapter {
  readonly id = "mock-fallback";
  readonly enabled = true;

  async generate(task: AssistantTask): Promise<AssistantResult> {
    if (task.type === "automation_draft") {
      return {
        provider: this.id,
        content: JSON.stringify(
          {
            trigger: {
              type: "record.updated",
              table: "Incidents",
            },
            actions: [
              {
                type: "create_notification",
                title: "Incident updated",
                body: "Review changes and assign owner.",
              },
              {
                type: "write_audit_log",
                action: "automation.generated",
              },
            ],
            notes: task.prompt,
          },
          null,
          2,
        ),
      };
    }

    if (task.type === "kpi_layout") {
      return {
        provider: this.id,
        content:
          "Layout suggestion: top row (Revenue, Active Incidents, SLA), middle row (trend line + owner load), bottom row (automation health + latest audit events).",
      };
    }

    return {
      provider: this.id,
      content:
        "Summary: prioritize high-severity records, monitor unresolved items older than 24h, and trigger owner reminders for stale tickets.",
    };
  }
}

class CloudFreeGatewayProvider implements ProviderAdapter {
  readonly id = "free-cloud-primary";

  get enabled() {
    return getServerEnv().AI_PROVIDER_MODE === "cloud_free";
  }

  async generate(task: AssistantTask): Promise<AssistantResult> {
    if (!this.enabled) {
      throw new Error("Cloud-free gateway provider is disabled.");
    }

    const env = getServerEnv();
    const endpoint = `${env.NEXT_PUBLIC_API_URL}/v1/ai/chat`;
    const payload = {
      prompt: task.prompt,
      task: task.type as AiChatTask,
      stream: false,
      ...(task.context ? { context: task.context } : {}),
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Cloud AI request failed with ${response.status}.`);
    }

    const parsed = aiChatResponseSchema.parse(await response.json());

    return {
      provider: parsed.provider,
      content: parsed.content,
    };
  }
}

class FallbackProviderChain implements ProviderAdapter {
  readonly id = "free-cloud-chain";

  constructor(
    private readonly primary: ProviderAdapter,
    private readonly fallback: ProviderAdapter,
  ) {}

  get enabled() {
    return this.primary.enabled || this.fallback.enabled;
  }

  async generate(task: AssistantTask): Promise<AssistantResult> {
    if (this.primary.enabled) {
      try {
        return await this.primary.generate(task);
      } catch {
        return this.fallback.generate(task);
      }
    }

    return this.fallback.generate(task);
  }
}

class MultiModelRouterProvider implements ProviderAdapter {
  readonly id = "multi-model-router";

  get enabled() {
    return !!process.env.OPENROUTER_API_KEY;
  }

  async generate(task: AssistantTask): Promise<AssistantResult> {
    if (!this.enabled) {
      throw new Error("Multi-model router requires OPENROUTER_API_KEY.");
    }

    const taskClassMap: Record<string, "coding" | "general" | "summary"> = {
      summarize_table: "summary",
      automation_draft: "coding",
      kpi_layout: "general",
    };

    const result = await routeRequest(task.prompt, {
      mode: "fast" as RouterMode,
      taskClass: taskClassMap[task.type] ?? "general",
    });

    return {
      provider: result.telemetry.modelUsed,
      content: result.content,
      routerTelemetry: result.telemetry,
    };
  }
}

export function getAssistantProvider(): ProviderAdapter {
  const router = new MultiModelRouterProvider();
  if (router.enabled) {
    return new FallbackProviderChain(
      router,
      new FallbackProviderChain(
        new CloudFreeGatewayProvider(),
        new MockLocalProvider(),
      ),
    );
  }
  return new FallbackProviderChain(
    new CloudFreeGatewayProvider(),
    new MockLocalProvider(),
  );
}
