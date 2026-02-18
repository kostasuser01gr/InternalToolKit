import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/(overview|home)$/);
}

async function signup(page: Page, name: string, email: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/(overview|home)$/);
}

test("login gate protects app routes", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fanalytics$/);
});

test("invalid session cookie does not loop between login and overview", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) {
    throw new Error("baseURL is required for this smoke test.");
  }

  const host = new URL(baseURL).hostname;
  await context.addCookies([
    {
      name: "uit_session",
      value: "stale.invalid.token",
      domain: host,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("login-page")).toBeVisible();
});

test("signup creates an account and can sign in", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  const nonce = Date.now();
  const email = `signup.${nonce}@internal.local`;
  const password = "Signup123!";

  await signup(page, "Signup Tester", email, password);
  await expect(page.getByTestId("home-page")).toBeVisible();

  await page.request.post("/api/session/logout", {
    headers: {
      Origin: "http://127.0.0.1:4173",
    },
  });

  await login(page, email, password);
  await expect(page.getByTestId("home-page")).toBeVisible();
});

test("responsive shell renders and navigation works without overflow", async ({
  page,
}, testInfo) => {
  await login(page, "admin@internal.local", "Admin123!");

  const projectName = testInfo.project.name.toLowerCase();
  const isMobile = projectName === "mobile";
  const isTablet = projectName === "tablet";
  const isDesktop = projectName === "desktop";

  if (isMobile) {
    await expect(page.getByTestId("mobile-header")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
  }

  if (isTablet) {
    await expect(page.getByTestId("mobile-header")).toBeVisible();
    await expect(page.getByTestId("side-rail")).toBeVisible();
  }

  if (isDesktop) {
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("topbar")).toBeVisible();
  }

  if (isMobile) {
    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.getByTestId("analytics-page")).toBeVisible();
  }

  if (isTablet) {
    await page.getByRole("link", { name: "Data" }).click();
    await expect(page).toHaveURL(/\/data/);
    await expect(page.getByTestId("data-page")).toBeVisible();
  }

  if (isDesktop) {
    await page.getByRole("link", { name: /^Data$/ }).first().click();
    await expect(page).toHaveURL(/\/data/);
    await expect(page.getByTestId("data-page")).toBeVisible();
  }

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBeFalsy();
});

test("command palette opens and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin@internal.local", "Admin123!");
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: "Open command palette" });
  const palette = page.getByTestId("command-palette");

  await trigger.click();

  if (!(await palette.isVisible())) {
    await page.keyboard.press("ControlOrMeta+K");
  }

  await expect(palette).toBeVisible();

  await page.getByLabel("Search commands").fill("go to analytics");
  await page.getByRole("button", { name: "Go to Analytics" }).first().click();
  await expect(page).toHaveURL(/\/analytics$/);

  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page).toHaveURL(/\/(dashboard|overview)$/);
});

test("data table: create table, add field, add record, export CSV", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin@internal.local", "Admin123!");
  await page.goto("/data");

  const tableName = `Playwright_${Date.now()}`;
  const fieldName = `Field_${Date.now()}`;

  await page.getByLabel("Create table").fill(tableName);
  await page.getByRole("button", { name: "Create table" }).click();
  await expect(page.getByText("Table created.")).toBeVisible();

  await page.getByPlaceholder("Field name").fill(fieldName);
  await page.getByRole("button", { name: "Add field" }).click();
  await expect(page.getByText("Field created.")).toBeVisible();

  await page.getByLabel(fieldName).fill("hello world");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByText("Record created.")).toBeVisible();
  await expect(page.getByText("hello world")).toBeVisible();

  const currentUrl = new URL(page.url());
  const workspaceId = currentUrl.searchParams.get("workspaceId");
  const tableId = currentUrl.searchParams.get("tableId");

  expect(workspaceId).toBeTruthy();
  expect(tableId).toBeTruthy();

  const exportResponse = await page.request.get(
    `/data/export?workspaceId=${workspaceId}&tableId=${tableId}`,
  );
  expect(exportResponse.ok()).toBeTruthy();
  expect(exportResponse.headers()["content-type"]).toContain("text/csv");
  expect(exportResponse.headers()["content-disposition"]).toContain(".csv");

  const csv = await exportResponse.text();
  expect(csv).toContain(fieldName);
  expect(csv).toContain("hello world");
});

test("admin gate: viewer blocked, admin allowed", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "viewer@internal.local", "Viewer123!");
  await page.goto("/admin");
  await expect(page.getByTestId("admin-blocked")).toBeVisible();

  await page.request.post("/api/session/logout", {
    headers: {
      Origin: "http://127.0.0.1:4173",
    },
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@internal.local");
  await page.getByLabel("Password").fill("Admin123!");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/admin");
  await expect(page.getByTestId("admin-page")).toBeVisible();
});
