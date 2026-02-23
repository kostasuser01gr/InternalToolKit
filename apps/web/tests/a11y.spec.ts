import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Only scan real HTML pages users visit — never JSON API routes.
const PAGES_TO_SCAN = ["/login"];

for (const path of PAGES_TO_SCAN) {
  test(`accessibility: ${path} has no critical violations`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (serious.length > 0) {
      const summary = serious
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`,
        )
        .join("\n");
      console.log(`Accessibility violations on ${path}:\n${summary}`);
    }

    expect(
      serious,
      `Found ${serious.length} critical/serious a11y violations on ${path}`,
    ).toHaveLength(0);
  });
}
