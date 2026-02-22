import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

async function login(page: Page, loginName: string, pin: string) {
  await page.goto("/login");
  await page.getByLabel("Login name").fill(loginName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat)$/);
}

async function loginWithPassword(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue with password" }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat)$/);
}

async function assertProtectedSessionPersists(page: Page) {
  await page.reload();
  await expect(page).toHaveURL(/\/(overview|home|chat)$/);
}

function createSessionToken(userId: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60;
  const body = Buffer.from(
    JSON.stringify({ uid: userId, iat: issuedAt, exp: expiresAt }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function signup(
  page: Page,
  name: string,
  loginName: string,
  email: string,
  pin: string,
  password: string,
) {
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Login name").fill(loginName);
  await page.getByLabel("4-digit PIN").fill(pin);
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

test("valid signed cookie for unknown user does not loop on login", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) {
    throw new Error("baseURL is required for this smoke test.");
  }

  const secret =
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-session-secret-change-before-production";
  const token = createSessionToken("user-that-does-not-exist", secret);
  const host = new URL(baseURL).hostname;

  await context.addCookies([
    {
      name: "uit_session",
      value: token,
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
  const loginName = `signup${nonce}`;
  const email = `signup.${nonce}@internal.local`;
  const pin = "0123";
  const password = "Signup123!";

  await signup(page, "Signup Tester", loginName, email, pin, password);
  await expect(page.getByTestId("home-page")).toBeVisible();
  await assertProtectedSessionPersists(page);

  await page.request.post("/api/session/logout", {
    headers: {
      Origin: "http://127.0.0.1:4173",
    },
  });

  await page.goto("/login");
  await page.getByLabel("Login name").fill(loginName);
  await page.getByLabel("PIN").fill("9999");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByText("Invalid credentials.")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("WrongPassword123!");
  await page.getByRole("button", { name: "Continue with password" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByText("Invalid credentials.")).toBeVisible();

  await login(page, loginName, pin);
  await expect(page.getByTestId("home-page")).toBeVisible();
  await assertProtectedSessionPersists(page);

  await page.request.post("/api/session/logout", {
    headers: {
      Origin: "http://127.0.0.1:4173",
    },
  });

  await loginWithPassword(page, email, password);
  await expect(page.getByTestId("home-page")).toBeVisible();
  await assertProtectedSessionPersists(page);
});

test("responsive shell renders and navigation works without overflow", async ({
  page,
}, testInfo) => {
  await login(page, "admin", "1234");

  const projectName = testInfo.project.name.toLowerCase();
  const isMobile = projectName === "mobile";
  const isTablet = projectName === "tablet";
  const isDesktop = projectName === "desktop";

  // Detect which shell is active (chat-first vs classic)
  const isChatFirst = await page.locator("[data-chat-first]").count().then((c) => c > 0);

  if (isChatFirst) {
    // Chat-first shell has a unified header visible on all viewports
    await expect(page.locator("[data-shell-root]")).toBeVisible();
  } else {
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
  }

  // Navigate to a module page
  if (isChatFirst) {
    // In chat-first, navigate via module shortcuts in left rail (desktop) or via URL
    await page.goto("/data");
    await expect(page.getByTestId("data-page")).toBeVisible();
  } else {
    if (isMobile) {
      await page
        .getByTestId("bottom-nav")
        .getByRole("link", { name: "Calendar" })
        .click();
      await expect(page).toHaveURL(/\/calendar/);
      await expect(page.getByTestId("calendar-page")).toBeVisible();
    }

    if (isTablet) {
      await page
        .getByTestId("side-rail")
        .getByRole("link", { name: "Data" })
        .click();
      await expect(page).toHaveURL(/\/data/);
      await expect(page.getByTestId("data-page")).toBeVisible();
    }

    if (isDesktop) {
      await page.getByRole("link", { name: /^Data$/ }).first().click();
      await expect(page).toHaveURL(/\/data/);
      await expect(page.getByTestId("data-page")).toBeVisible();
    }
  }

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBeFalsy();
});

test("command palette opens and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin", "1234");
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: "Open command palette" });
  const palette = page.getByTestId("command-palette");

  await trigger.click();

  if (!(await palette.isVisible())) {
    await page.keyboard.press("ControlOrMeta+K");
  }

  await expect(palette).toBeVisible();

  await page.getByLabel("Search commands").fill("go to analytics");
  await palette.getByRole("button", { name: /^Go to Analytics/ }).first().click();
  await expect(page).toHaveURL(/\/analytics$/);

  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page).toHaveURL(/\/(dashboard|overview)$/);
});

test("data table: create table, add field, add record, export CSV", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin", "1234");
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

  await login(page, "viewer", "2222");
  await page.goto("/admin");
  await expect(page.getByTestId("admin-blocked")).toBeVisible();

  await page.request.post("/api/session/logout", {
    headers: {
      Origin: "http://127.0.0.1:4173",
    },
  });

  await login(page, "admin", "1234");
  await page.goto("/admin");
  await expect(page.getByTestId("admin-page")).toBeVisible();
});

test("chat basic flow: create thread and send message", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin", "1234");
  await page.goto("/chat");

  const threadTitle = `Playwright Chat ${Date.now()}`;
  await page.getByLabel("New thread").fill(threadTitle);
  await page.getByRole("button", { name: "Create thread" }).click();
  await expect(page.getByText("Thread created.")).toBeVisible();

  const message = `Hello from Playwright ${Date.now()}`;
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Message sent.")).toBeVisible();
  await expect(page.getByText(message)).toBeVisible();
});

test("shift planner flow: create shift and show in board", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin", "1234");
  await page.goto("/shifts");

  const title = `Shift ${Date.now()}`;
  const now = Date.now();
  const startsAt = new Date(now + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const endsAt = new Date(now + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);

  await page.getByLabel("Title").fill(title);
  await page.locator("#shift-startsAt").fill(startsAt);
  await page.locator("#shift-endsAt").fill(endsAt);
  await page.getByRole("button", { name: "Create shift" }).click();

  await expect(page.getByText("Shift created.")).toBeVisible();
  await expect(page.getByTestId("shifts-board")).toContainText(title);
});

test("fleet flow: create and update vehicle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.toLowerCase() !== "desktop");

  await login(page, "admin", "1234");
  await page.goto("/fleet");

  const plate = `PW-${Date.now()}`.slice(-10);
  const model = "Playwright Test Car";

  await page.getByLabel("Plate number").fill(plate);
  await page.getByLabel("Model").fill(model);
  await page.getByLabel("Mileage (km)").first().fill("1000");
  await page.getByLabel("Fuel (%)").first().fill("80");
  await page.getByRole("button", { name: "Add vehicle" }).click();

  await expect(page.getByText("Vehicle added.")).toBeVisible();
  await expect(page.getByText(plate)).toBeVisible();

  await page.getByText(plate).first().click();
  // Full update form is now in a <details> element
  await page.getByText("Full update form").click();
  await page.getByLabel("Fuel (%)").nth(1).fill("73");
  await page.getByRole("button", { name: "Save vehicle update" }).click();

  await expect(page.getByText("Vehicle updated.")).toBeVisible();
});
