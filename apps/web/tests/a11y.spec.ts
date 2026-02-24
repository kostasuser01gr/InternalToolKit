import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Only scan real HTML pages users visit — never JSON API routes.
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

const APP_PAGES = [
  "/home",
  "/overview",
  "/chat",
  "/shifts",
  "/fleet",
  "/washers",
  "/calendar",
  "/data",
  "/analytics",
  "/settings",
  "/notifications",
  "/imports",
  "/feeds",
  "/ops-inbox",
  "/controls",
  "/activity",
  "/reports",
  "/admin",
  "/automations",
  "/assistant",
  "/dashboard",
  "/components",
];

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function loginForA11y(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Login name").fill("admin");
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat|dashboard)/, { timeout: 15_000 });
}

/* ------------------------------------------------------------------ */
/*  Auth pages (no login needed)                                       */
/* ------------------------------------------------------------------ */

for (const path of AUTH_PAGES) {
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

/* ------------------------------------------------------------------ */
/*  App pages (login required)                                         */
/* ------------------------------------------------------------------ */

for (const path of APP_PAGES) {
  test(`accessibility: ${path} has no critical violations`, async ({
    page,
  }, testInfo) => {
    // Only run app page a11y on Desktop to save time
    test.skip(testInfo.project.name.toLowerCase() !== "desktop");

    await loginForA11y(page);
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");

    // Skip if redirected to login (page needs specific permissions)
    if (page.url().includes("/login")) {
      console.log(`Skipping a11y for ${path}: redirected to login`);
      return;
    }

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

      // Take screenshot for evidence
      await page.screenshot({
        path: `test-results/a11y-${path.replace(/\//g, "_")}.png`,
      });
    }

    // Fail only on critical/serious
    expect(
      serious,
      `Found ${serious.length} critical/serious a11y violations on ${path}`,
    ).toHaveLength(0);
  });
}
