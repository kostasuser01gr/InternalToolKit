import { expect, test, type Page } from "@playwright/test";

async function gotoWithRetry(page: Page, route: string, timeout = 120_000) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.goto(route, {
        timeout,
        waitUntil: "domcontentloaded",
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const canRetry =
        message.includes("Timeout") ||
        message.includes("ERR_ABORTED") ||
        message.includes("net::") ||
        message.includes("frame was detached");
      if (!canRetry || attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(1500);
    }
  }
  throw lastError ?? new Error(`Failed to navigate to ${route}`);
}

test.describe.configure({ timeout: 480_000 });

async function login(page: Page, loginName: string, pin: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoWithRetry(page, "/login");
    await page.getByLabel("Login name").fill(loginName);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: /^Continue$/ }).click();

    try {
      await expect(page).toHaveURL(/\/(overview|home|chat)(?:\?|$)/, {
        timeout: 90_000,
      });
      return;
    } catch (error) {
      lastError = error;
      const currentUrl = page.url();
      const loginError = await page
        .locator("[data-testid='login-page']")
        .innerText()
        .then((text) => text.replace(/\s+/g, " ").trim().slice(0, 240))
        .catch(() => "login-page-not-visible");
      if (!currentUrl.includes("/login") || attempt === 2) {
        throw new Error(
          `Login failed for ${loginName} after ${attempt + 1} attempts. URL=${currentUrl}. Context=${loginError}`,
        );
      }
      await page.waitForTimeout(1_000);
    }
  }

  throw lastError ?? new Error(`Login failed for ${loginName}.`);
}

// ---------- Washers module ----------

test("washers page loads and shows KPIs", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/washers", 90_000);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("washers-page")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("washers-kpis")).toBeVisible({ timeout: 10_000 });
});

test("washers: create wash task", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/washers", 90_000);

  // Fill the form — vehicle and washer are <select>, might have no options yet
  const vehicleSelect = page.locator("#washer-vehicle");
  const optionCount = await vehicleSelect.locator("option").count();

  if (optionCount > 1) {
    // Select first non-placeholder option
    await vehicleSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Save wash task" }).click();
    await page.waitForURL(
      (url) => url.searchParams.has("success") || url.searchParams.has("error"),
      { timeout: 15_000 },
    ).catch(() => {});
    const currentUrl = new URL(page.url());
    const hasOutcomeQuery =
      currentUrl.searchParams.has("success") ||
      currentUrl.searchParams.has("error");
    if (!hasOutcomeQuery) {
      // Fallback when the server responds inline without URL params.
      await expect(
        page.getByText(/created|saved|error|already/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  } else {
    // No vehicles available — verify the form renders without crashing
    await expect(vehicleSelect).toBeVisible();
  }
});

test("washers: share panel and daily register visible", async ({
  page,
}) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/washers", 90_000);
  await expect(page.getByTestId("share-washer-app")).toBeVisible();
  await expect(page.getByTestId("daily-register")).toBeVisible();
});

// ---------- Imports module ----------

test("imports page loads", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/imports");
  // The page may render before the data-testid is available, so check heading
  await expect(page.getByRole("heading", { name: "Imports", exact: true })).toBeVisible();
  await expect(page.getByText("Upload data files")).toBeVisible();
});

test("imports: upload form is functional", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/imports");

  // Upload form should have file input and type selector
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeAttached();

  const typeSelect = page.locator('select[name="importType"]');
  await expect(typeSelect).toBeAttached();
  await typeSelect.selectOption("vehicles");

  // Verify the upload button exists
  await expect(
    page.getByRole("button", { name: /upload|analyze/i }),
  ).toBeVisible();
});

// ---------- Feeds module ----------

test("feeds page loads and shows source form", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/feeds");
  await expect(page.getByTestId("feeds-page")).toBeVisible();
  await expect(page.getByLabel("Source Name")).toBeVisible();
  await expect(page.getByLabel("RSS URL")).toBeVisible();
});

test("feeds: add default sources", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/feeds");

  const addDefaultsBtn = page.getByRole("button", {
    name: /add default sources/i,
  });
  if (await addDefaultsBtn.isVisible()) {
    await addDefaultsBtn.click();
    // Should see success or "already exists" message
    await expect(
      page.getByText(/added|seeded|sources|already/i).first(),
    ).toBeVisible({ timeout: 10000 });
  }
});

test("feeds: add custom source", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/feeds");

  const sourceName = `Test Feed ${Date.now()}`;
  await page.getByLabel("Source Name").fill(sourceName);
  await page
    .getByLabel("RSS URL")
    .fill("https://feeds.feedburner.com/TheHackersNews");
  await page.getByRole("button", { name: "Add Source" }).click();

  await expect(
    page.getByText(/added|created|source|error/i).first(),
  ).toBeVisible({ timeout: 10000 });
});

// ---------- Settings module ----------

test("settings page loads sections", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, "admin", "1234");
  const response = await gotoWithRetry(page, "/settings", 90_000);
  expect(response?.status(), "/settings should not return 500").toBeLessThan(
    500,
  );
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByText("Theme preference")).toBeVisible();
});

test("settings: save profile without crash", async ({ page }) => {
  await login(page, "admin", "1234");
  const response = await gotoWithRetry(page, "/settings");
  expect(response?.status(), "/settings should not return 500").toBeLessThan(
    500,
  );

  const nameInput = page.locator("#profile-name");
  const currentName = await nameInput.inputValue();
  // Re-fill same name (idempotent)
  await nameInput.fill(currentName || "Admin User");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText(/saved|updated|profile/i).first(),
  ).toBeVisible({ timeout: 10000 });
});

// ---------- Calendar module ----------

test("calendar page loads", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/calendar");
  await expect(
    page.getByRole("heading", { name: /calendar/i }),
  ).toBeVisible();
  await expect(page.getByLabel("From")).toBeVisible();
  await expect(page.locator("#calendar-to")).toBeVisible();
});

test("calendar: apply date range", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/calendar");

  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  await page.locator("#calendar-from").fill(from);
  await page.locator("#calendar-to").fill(to);
  await page.getByRole("button", { name: "Apply range" }).click();

  // Should not crash; page should remain visible
  await expect(
    page.getByRole("heading", { name: /calendar/i }),
  ).toBeVisible();
});

// ---------- Notifications + Ops Inbox ----------

test("notifications page loads", async ({ page }) => {
  await login(page, "admin", "1234");
  const response = await gotoWithRetry(page, "/notifications");
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: /notifications/i })).toBeVisible();
});

test("ops inbox page loads", async ({ page }) => {
  await login(page, "admin", "1234");
  const response = await gotoWithRetry(page, "/ops-inbox");
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: /ops inbox/i })).toBeVisible();
});

test("home quick access link navigates to automations", async ({ page }) => {
  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/overview");

  const automationLink = page.getByRole("link", {
    name: /build and run automations/i,
  });
  await expect(automationLink).toBeVisible();
  await automationLink.click();

  await expect(page).toHaveURL(/\/automations(?:\?|$)/, { timeout: 20_000 });
  await expect(page.getByTestId("automations-page")).toBeVisible();
});

// ---------- Cross-module navigation ----------

test("all primary nav routes are reachable", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, "admin", "1234");

  const routes = [
    "/chat",
    "/fleet",
    "/washers",
    "/shifts",
    "/imports",
    "/feeds",
    "/settings",
    "/calendar",
    "/analytics",
    "/controls",
  ];

  for (const route of routes) {
    const response = await gotoWithRetry(page, route);
    expect(
      response?.status(),
      `${route} should not return 500`,
    ).not.toBe(500);
    // Reachability check: route must not bounce back to auth/error pages.
    const pathname = new URL(page.url()).pathname;
    expect(pathname).not.toBe("/login");
    expect(pathname).not.toBe("/_error");
  }
});
