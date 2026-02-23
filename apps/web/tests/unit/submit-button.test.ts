import { describe, expect, it } from "vitest";

// Static analysis tests — verify component exports and structure
describe("SubmitButton component", () => {
  it("exports SubmitButton from submit-button module", async () => {
    const mod = await import("@/components/kit/submit-button");
    expect(mod.SubmitButton).toBeDefined();
    expect(typeof mod.SubmitButton).toBe("function");
  });
});

describe("FormSubmitButton component", () => {
  it("exports FormSubmitButton from form-submit-button module", async () => {
    const mod = await import("@/components/kit/form-submit-button");
    expect(mod.FormSubmitButton).toBeDefined();
    expect(typeof mod.FormSubmitButton).toBe("function");
  });
});
