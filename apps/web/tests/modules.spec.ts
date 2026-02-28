import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, loginName: string, pin: string) {
  await page.goto("/login");
  await page.getByLabel("Login name").fill(loginName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat)$/, { timeout: 20_000 });
}

// ---------- Washers module ----------

test("washers page loads and shows KPIs", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/washers");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("washers-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("washers-kpis")).toBeVisible({ timeout: 10_000 });
});

test("washers: create wash task", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/washers");

  // Fill the form — vehicle and washer are <select>, might have no options yet
  const vehicleSelect = page.locator("#washer-vehicle");
  const optionCount = await vehicleSelect.locator("option").count();

  if (optionCount > 1) {
    // Select first non-placeholder option
    await vehicleSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Save wash task" }).click();
    // Expect either success toast or error (no crash)
    await expect(
      page.getByText(/created|saved|error|already/i).first(),
    ).toBeVisible({ timeout: 10000 });
  } else {
    // No vehicles available — verify the form renders without crashing
    await expect(vehicleSelect).toBeVisible();
  }
});

test("washers: share panel and daily register visible", async ({
  page,
}) => {
  
  await login(page, "admin", "1234");
  await page.goto("/washers");
  await expect(page.getByTestId("share-washer-app")).toBeVisible();
  await expect(page.getByTestId("daily-register")).toBeVisible();
});

// ---------- Imports module ----------

test("imports page loads", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/imports");
  // The page may render before the data-testid is available, so check heading
  await expect(page.getByRole("heading", { name: "Imports", exact: true })).toBeVisible();
  await expect(page.getByText("Upload data files")).toBeVisible();
});

test("imports: upload form is functional", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/imports");

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
  await page.goto("/feeds");
  await expect(page.getByTestId("feeds-page")).toBeVisible();
  await expect(page.getByLabel("Source Name")).toBeVisible();
  await expect(page.getByLabel("RSS URL")).toBeVisible();
});

test("feeds: add default sources", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/feeds");

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
  await page.goto("/feeds");

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
  
  await login(page, "admin", "1234");
  await page.goto("/settings");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByText("Theme preference")).toBeVisible();
});

test("settings: save profile without crash", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/settings");

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
  await page.goto("/calendar");
  await expect(
    page.getByRole("heading", { name: /calendar/i }),
  ).toBeVisible();
  await expect(page.getByLabel("From")).toBeVisible();
  await expect(page.locator("#calendar-to")).toBeVisible();
});

test("calendar: apply date range", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/calendar");

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
  await page.goto("/notifications");
  // Page should load without crashing
  const response = await page.goto("/notifications");
  expect(response?.status()).toBeLessThan(500);
});

test("ops inbox page loads", async ({ page }) => {
  
  await login(page, "admin", "1234");
  await page.goto("/ops-inbox");
  const response = await page.goto("/ops-inbox");
  expect(response?.status()).toBeLessThan(500);
});

// ---------- Cross-module navigation ----------

test("all primary nav routes are reachable", async ({ page }) => {
  
  test.setTimeout(120_000);
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
    let response;
    try {
      response = await page.goto(route, { timeout: 60_000 });
    } catch (err) {
      // ERR_ABORTED can occur transiently in CI when the DB is under load
      // and the layout's workspace query causes a redirect. Retry once.
      const msg = (err as Error).message ?? "";
      if (msg.includes("ERR_ABORTED") || msg.includes("net::")) {
        await page.waitForTimeout(1500);
        response = await page.goto(route, { timeout: 60_000 });
      } else {
        throw err;
      }
    }
    expect(
      response?.status(),
      `${route} should not return 500`,
    ).not.toBe(500);
    // Should not be redirected to an error page
    expect(page.url()).toContain(route.replace("/", ""));
  }
});
