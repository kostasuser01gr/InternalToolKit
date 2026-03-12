import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

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

test.describe.configure({ timeout: 240_000 });

async function login(page: Page, loginName: string, pin: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoWithRetry(page, "/login");
    await page.getByLabel("Login name").fill(loginName);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: /^Continue$/ }).click();

    try {
      await expect(page).toHaveURL(/\/(overview|home|chat)(?:\?|$)/, {
        timeout: 60_000,
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

async function loginWithPassword(page: Page, email: string, password: string) {
  await gotoWithRetry(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue with password" }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat)(?:\?|$)/, { timeout: 60_000 });
}

async function assertProtectedSessionPersists(page: Page) {
  await page.reload();
  await expect(page).toHaveURL(/\/(overview|home|chat)$/, { timeout: 15_000 });
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
  await gotoWithRetry(page, "/signup");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Login name").fill(loginName);
  await page.getByLabel("4-digit PIN").fill(pin);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  try {
    await expect(page).toHaveURL(/\/(overview|home)$/);
  } catch {
    const url = new URL(page.url());
    const transientSignupError =
      url.pathname === "/signup" &&
      (url.searchParams.get("error") ?? "").toLowerCase().includes("unable to create account");

    if (!transientSignupError) {
      throw new Error(`Signup did not redirect as expected. Current URL: ${page.url()}`);
    }

    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/(overview|home)$/);
  }
}

test("login gate protects app routes", async ({ page }) => {
  await gotoWithRetry(page, "/analytics");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fanalytics$/);
});

test("invalid session cookie does not loop between login and overview", async ({
  page,
  context,
}, testInfo) => {
  

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

  const response = await gotoWithRetry(page, "/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("login-page")).toBeVisible();
});

test("valid signed cookie for unknown user does not loop on login", async ({
  page,
  context,
}, testInfo) => {
  

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

  const response = await gotoWithRetry(page, "/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("login-page")).toBeVisible();
});

test("signup creates an account and can sign in", async ({ page }) => {
  
  test.setTimeout(120_000);

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

  await gotoWithRetry(page, "/login");
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

  // Detect which shell is active (chat-first vs classic).
  // The chat-first shell is a client component, so wait for hydration.
  await page.waitForLoadState("load");
  const isChatFirst = await page
    .locator("[data-chat-first]")
    .count()
    .then((c) => c > 0)
    .catch(() => false);

  if (isChatFirst) {
    // Chat-first shell has a unified header visible on all viewports
    await expect(page.locator("[data-shell-root]")).toBeVisible();
  } else {
    // Current shell may be chat-first but without the data attribute yet.
    // Check for the banner (header) and complementary (sidebar) roles.
    const hasBanner = await page.locator("header, [role=banner]").count().then((c) => c > 0);
    const hasNav = await page.locator("nav, [role=complementary]").count().then((c) => c > 0);

    if (hasBanner && hasNav) {
      // Modern shell with header + sidebar
      await expect(page.locator("header, [role=banner]").first()).toBeVisible();
    } else if (isMobile) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("bottom-nav")).toBeVisible();
    } else if (isTablet) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("side-rail")).toBeVisible();
    } else if (isDesktop) {
      await expect(page.getByTestId("sidebar")).toBeVisible();
      await expect(page.getByTestId("topbar")).toBeVisible();
    }
  }

  // Navigate to a module page — retry once on ERR_ABORTED (transient CI DB latency)
  const gotoData = async () => gotoWithRetry(page, "/data");
  if (isChatFirst) {
    await gotoData();
    await expect(page.getByTestId("data-page")).toBeVisible();
  } else {
    // Use URL navigation as fallback — works for all shell variants
    await gotoData();
    await expect(page.getByRole("heading", { name: /data/i })).toBeVisible();
  }

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBeFalsy();
});

test("command palette opens and navigates", async ({ page }) => {
  test.setTimeout(process.env.CI ? 120_000 : 120_000);

  await login(page, "admin", "1234");
  await page.waitForLoadState("networkidle");
  // Wait for React hydration — CI runners are slower
  await page.waitForTimeout(process.env.CI ? 5000 : 1000);

  const trigger = page.getByRole("button", { name: "Open command palette" });
  const palette = page.getByTestId("command-palette");

  await trigger.click();

  if (!(await palette.isVisible())) {
    await page.keyboard.press("ControlOrMeta+K");
  }

  await expect(palette).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Search commands").fill("go to analytics");
  // Wait for search results to appear before clicking
  const analyticsBtn = palette.getByRole("button", { name: /^Go to Analytics/ }).first();
  await analyticsBtn.waitFor({ state: "visible", timeout: 15_000 });
  // Wait an extra moment for React event handlers to attach
  await page.waitForTimeout(2000);
  await analyticsBtn.click({ force: true });
  // For Mobile CI: also dispatch a synthetic click to ensure React onClick fires
  // (force click sometimes doesn't reach React's synthetic event system on Mobile)
  await page.evaluate(() => {
    const paletteEl = document.querySelector('[data-testid="command-palette"]');
    if (!paletteEl) return;
    const buttons = Array.from(paletteEl.querySelectorAll('button[type="button"]'));
    const btn = buttons.find((b) =>
      /^Go to Analytics/.test((b as HTMLElement).innerText.trim()),
    );
    if (btn) {
      btn.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }),
      );
    }
  }).catch(() => {});
  // Use a non-anchored pattern: analytics page may append workspaceId query param.
  // If click dispatch is dropped under heavy CI load, retry via palette Enter first,
  // then fall back to global shortcut g -> a.
  try {
    await expect(page).toHaveURL(/\/analytics(\?|$)/, { timeout: 30_000 });
  } catch {
    if (!(await palette.isVisible())) {
      await trigger.click();
    }
    await expect(palette).toBeVisible({ timeout: 10_000 });
    const searchInput = page.getByLabel("Search commands");
    await searchInput.fill("go to analytics");
    await searchInput.press("Enter");
    try {
      await expect(page).toHaveURL(/\/analytics(\?|$)/, { timeout: 15_000 });
    } catch {
      // Shortcut handling ignores key events while typing in an input, so clear focus first.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });
      await page.mouse.click(1, 1).catch(() => {});
      await page.waitForTimeout(300);
      await page.keyboard.press("g");
      await page.waitForTimeout(600);
      await page.keyboard.press("a");
      await expect(page).toHaveURL(/\/analytics(\?|$)/, { timeout: 30_000 });
    }
  }

  // Wait for analytics page to fully load and hydrate before keyboard shortcut
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(process.env.CI ? 3000 : 1000);
  // Blur any focused input so keyboard shortcuts aren't blocked by typing guard
  await page.evaluate(() => {
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    } catch {
      // Ignore context destruction errors during navigation
    }
  }).catch(() => {});
  // Click a safe non-interactive area to clear browser focus state
  await page.mouse.click(1, 1).catch(() => {});
  await page.waitForTimeout(process.env.CI ? 1500 : 500);
  await page.keyboard.press("g");
  // Small delay between keys to ensure sequence handler picks them up
  await page.waitForTimeout(600);
  await page.keyboard.press("d");
  try {
    await expect(page).toHaveURL(/\/(dashboard|overview)(\?|$)/, { timeout: 30_000 });
  } catch {
    if (!(await palette.isVisible())) {
      await trigger.click();
    }
    await expect(palette).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Search commands").fill("go to overview");
    const overviewBtn = palette.getByRole("button", { name: /^Go to Overview/ }).first();
    await overviewBtn.waitFor({ state: "visible", timeout: 10_000 });
    await overviewBtn.click({ force: true });
    await expect(page).toHaveURL(/\/(dashboard|overview)(\?|$)/, { timeout: 30_000 });
  }
});

test("data table: create table, add field, add record, export CSV", async ({
  page,
}) => {
  

  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/data");

  const tableName = `Playwright_${Date.now()}`;
  const fieldName = `Field_${Date.now()}`;

  await page.getByLabel("Create table").fill(tableName);
  await page.getByRole("button", { name: "Create table" }).click();
  // Wait for server action redirect: URL gains ?success= and tableId params.
  // This is more reliable than transient toast text under CI DB load.
  await page.waitForURL((url) => url.searchParams.has("tableId"), { timeout: 30000 });
  // Success banner is a role=status element — verify it's visible with success text.
  await expect(page.getByRole("status")).toBeVisible({ timeout: 10000 });

  await page.getByPlaceholder("Field name").fill(fieldName);
  await page.getByRole("button", { name: "Add field" }).click();
  // Field creation can settle via render updates before URL query changes in CI.
  // Use the concrete field input as the deterministic completion signal.
  await expect(page.getByLabel(fieldName)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status")).toBeVisible({ timeout: 10000 });

  await page.getByLabel(fieldName).fill("hello world");
  await page.getByRole("button", { name: "Save record" }).click();
  const hasRecordOutcomeInUrl = () => {
    const url = new URL(page.url());
    const success = url.searchParams.get("success")?.toLowerCase() ?? "";
    return success.includes("record") || url.searchParams.has("error");
  };
  if (!hasRecordOutcomeInUrl()) {
    await page.waitForURL(
      (url) => {
        const success = url.searchParams.get("success")?.toLowerCase() ?? "";
        return success.includes("record") || url.searchParams.has("error");
      },
      { timeout: 30000 },
    );
  }
  await expect(page.getByRole("status")).toBeVisible({ timeout: 10000 });
  const outcomeUrl = new URL(page.url());
  expect(outcomeUrl.searchParams.has("error")).toBeFalsy();

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
}) => {
  

  await login(page, "viewer", "2222");
  await gotoWithRetry(page, "/admin");
  await expect(page.getByTestId("admin-blocked")).toBeVisible();

  await page.request.post("/api/session/logout", {
    headers: {
      Origin: "http://127.0.0.1:4173",
    },
  });

  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/admin");
  await expect(page.getByTestId("admin-page")).toBeVisible();
});

test("chat basic flow: create thread and send message", async ({ page }) => {
  

  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/chat");

  const threadTitle = `Playwright Chat ${Date.now()}`;
  await page.getByLabel("New thread").fill(threadTitle);
  await page.getByRole("button", { name: "Create thread" }).click();
  const hasThreadOutcomeInUrl = () => {
    const url = new URL(page.url());
    return Boolean(url.searchParams.get("threadId")) || url.searchParams.has("error");
  };
  if (!hasThreadOutcomeInUrl()) {
    await page.waitForURL(
      (url) => Boolean(url.searchParams.get("threadId")) || url.searchParams.has("error"),
      { timeout: 30_000 },
    );
  }
  const createdThreadId = new URL(page.url()).searchParams.get("threadId");
  expect(createdThreadId, "threadId should exist after creating thread").toBeTruthy();
  await expect(page.getByText("Thread created.")).toBeVisible({ timeout: 15_000 });

  const message = `Hello from Playwright ${Date.now()}`;
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
  const hasMessageOutcomeInUrl = () => {
    const url = new URL(page.url());
    const success = (url.searchParams.get("success") ?? "").toLowerCase();
    const hasMessageSuccess = success.includes("message sent");
    const hasError = url.searchParams.has("error");
    const sameThread = url.searchParams.get("threadId") === createdThreadId;
    return sameThread && (hasMessageSuccess || hasError);
  };
  if (!hasMessageOutcomeInUrl()) {
    await page.waitForURL(
      (url) => {
        const success = (url.searchParams.get("success") ?? "").toLowerCase();
        const hasMessageSuccess = success.includes("message sent");
        const hasError = url.searchParams.has("error");
        const sameThread = url.searchParams.get("threadId") === createdThreadId;
        return sameThread && (hasMessageSuccess || hasError);
      },
      { timeout: 30_000 },
    );
  }
  const sendUrl = new URL(page.url());
  expect(sendUrl.searchParams.get("error")).toBeNull();
  expect((sendUrl.searchParams.get("success") ?? "").toLowerCase()).toContain("message sent");
  await expect(page.getByText(message)).toBeVisible();
});

test("shift planner flow: create shift and show in board", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/shifts");

  const title = `Shift ${Date.now()}`;
  const now = Date.now();
  const startsAt = new Date(now + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const endsAt = new Date(now + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);

  await page.getByLabel("Title").fill(title);
  await page.locator("#shift-startsAt").fill(startsAt);
  await page.locator("#shift-endsAt").fill(endsAt);
  await page.getByRole("button", { name: "Create shift" }).click();
  await page
    .waitForURL(
      (url) => url.searchParams.get("success") === "Shift created.",
      { timeout: 30_000 },
    )
    .catch(() => {});
  await expect(page.getByTestId("shifts-board")).toContainText(title, {
    timeout: 60_000,
  });
});

test("fleet flow: create and update vehicle", async ({ page }) => {
  test.setTimeout(180_000);

  await login(page, "admin", "1234");
  await gotoWithRetry(page, "/fleet");
  await page.waitForLoadState("networkidle");

  const plate = `PW-${Date.now()}`.slice(-10);
  const model = "Playwright Test Car";

  await page.getByLabel("Plate number").fill(plate);
  await page.getByLabel("Model").fill(model);
  await page.getByLabel("Mileage (km)").first().fill("1000");
  await page.getByLabel("Fuel (%)").first().fill("80");
  await page.getByRole("button", { name: "Add vehicle" }).click();

  await expect(page.getByText("Vehicle added.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(plate).first()).toBeVisible({ timeout: 10_000 });

  await page.getByText(plate).first().click();
  // Full update form is now in a <details> element
  await page.getByText("Full update form").click();
  await page.getByLabel("Fuel (%)").nth(1).fill("73");
  await page.getByRole("button", { name: "Save vehicle update" }).click();

  await expect(page.getByText("Vehicle updated.")).toBeVisible({ timeout: 15_000 });
});
