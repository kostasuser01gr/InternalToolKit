import { describe, expect, it, beforeEach } from "vitest";

import {
  classifyTask,
  redactSecrets,
  selectModels,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  resetCircuits,
  FREE_MODELS,
  getModelHealth,
} from "@/lib/assistant/router";

describe("classifyTask", () => {
  it("classifies coding prompts", () => {
    expect(classifyTask("Write a function to sort an array")).toBe("coding");
    expect(classifyTask("Fix this TypeScript error")).toBe("coding");
    expect(classifyTask("Debug my SQL query")).toBe("coding");
  });

  it("classifies summary prompts", () => {
    expect(classifyTask("Summarize the daily report")).toBe("summary");
    expect(classifyTask("Give me a TLDR of this")).toBe("summary");
    expect(classifyTask("Brief overview of incidents")).toBe("summary");
  });

  it("classifies general prompts", () => {
    expect(classifyTask("What is the weather today?")).toBe("general");
    expect(classifyTask("Help me plan a meeting")).toBe("general");
    expect(classifyTask("How many washers are active?")).toBe("general");
  });
});

describe("redactSecrets", () => {
  it("redacts email addresses", () => {
    expect(redactSecrets("Contact john@example.com")).toBe(
      "Contact [EMAIL]",
    );
  });

  it("redacts API keys", () => {
    expect(redactSecrets("Use key sk-abc123456789012345678901")).toContain(
      "[REDACTED_KEY]",
    );
    expect(redactSecrets("Token ghp_abcdefghijklmnopqrstuvwxyz1234")).toContain(
      "[REDACTED_KEY]",
    );
  });

  it("redacts connection strings", () => {
    expect(
      redactSecrets("DB: postgresql://user:pass@host:5432/db"),
    ).toContain("[REDACTED_CONN_STRING]");
  });

  it("leaves safe text unchanged", () => {
    const safe = "Create a wash task for vehicle ABC-1234";
    expect(redactSecrets(safe)).toBe(safe);
  });
});

describe("selectModels", () => {
  beforeEach(() => {
    resetCircuits();
  });

  it("returns models matching task class", () => {
    const models = selectModels("coding", "best");
    expect(models.length).toBeGreaterThan(0);
    for (const id of models) {
      const model = FREE_MODELS.find((m) => m.id === id);
      expect(model?.strengths).toContain("coding");
    }
  });

  it("returns models for summary tasks", () => {
    const models = selectModels("summary", "best");
    expect(models.length).toBeGreaterThan(0);
    for (const id of models) {
      const model = FREE_MODELS.find((m) => m.id === id);
      expect(model?.strengths).toContain("summary");
    }
  });

  it("fast mode limits to 3 models", () => {
    const models = selectModels("general", "fast");
    expect(models.length).toBeLessThanOrEqual(3);
  });

  it("excludes models with open circuits", () => {
    const target = FREE_MODELS[0]!.id;
    // Trip the circuit
    for (let i = 0; i < 3; i++) recordFailure(target);
    expect(isCircuitOpen(target)).toBe(true);

    const models = selectModels("general", "best");
    expect(models).not.toContain(target);
  });
});

describe("circuit breaker", () => {
  beforeEach(() => {
    resetCircuits();
  });

  it("starts closed", () => {
    expect(isCircuitOpen("test-model")).toBe(false);
  });

  it("opens after 3 failures within window", () => {
    for (let i = 0; i < 3; i++) {
      recordFailure("test-model");
    }
    expect(isCircuitOpen("test-model")).toBe(true);
  });

  it("does not open with fewer than 3 failures", () => {
    recordFailure("test-model");
    recordFailure("test-model");
    expect(isCircuitOpen("test-model")).toBe(false);
  });

  it("resets on success", () => {
    for (let i = 0; i < 3; i++) recordFailure("test-model");
    expect(isCircuitOpen("test-model")).toBe(true);

    // After cooldown the circuit resets, but success also clears it
    recordSuccess("test-model");
    expect(isCircuitOpen("test-model")).toBe(false);
  });

  it("getModelHealth returns status for all models", () => {
    const health = getModelHealth();
    expect(health).toHaveLength(FREE_MODELS.length);
    for (const h of health) {
      expect(h.circuitOpen).toBe(false);
      expect(h.failures).toBe(0);
    }
  });
});
