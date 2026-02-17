export type AssistantTask = {
  type: "summarize_table" | "automation_draft" | "kpi_layout";
  prompt: string;
  context?: Record<string, unknown>;
};

export type AssistantResult = {
  provider: string;
  content: string;
};

export interface ProviderAdapter {
  readonly id: string;
  readonly enabled: boolean;
  generate(task: AssistantTask): Promise<AssistantResult>;
}

class MockLocalProvider implements ProviderAdapter {
  readonly id = "mock-local";
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

class OpenAIAdapter implements ProviderAdapter {
  readonly id = "openai-stub";

  get enabled() {
    return (
      Boolean(process.env.OPENAI_API_KEY) &&
      process.env.ASSISTANT_PROVIDER === "openai"
    );
  }

  async generate(task: AssistantTask): Promise<AssistantResult> {
    if (!this.enabled) {
      throw new Error(
        "OpenAI adapter is disabled. Set ASSISTANT_PROVIDER=openai and OPENAI_API_KEY to enable.",
      );
    }

    return {
      provider: this.id,
      content: `OpenAI adapter stub executed for task: ${task.type}.`,
    };
  }
}

export function getAssistantProvider(): ProviderAdapter {
  const openAI = new OpenAIAdapter();

  if (openAI.enabled) {
    return openAI;
  }

  return new MockLocalProvider();
}
