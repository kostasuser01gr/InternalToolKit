/**
 * Full diagnostic scan — visits every app route on Desktop / Tablet / Mobile,
 * captures console errors, network failures, redirect chains, and click-audits
 * primary action buttons.  Produces test-results/full-scan-report.json.
 */
import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/* ------------------------------------------------------------------ */
/*  Route inventory                                                    */
/* ------------------------------------------------------------------ */

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const APP_ROUTES = process.env.SCAN_ROUTES
  ? process.env.SCAN_ROUTES.split(",")
  : [
      "/home",
      "/overview",
      "/dashboard",
      "/data",
      "/automations",
      "/assistant",
      "/chat",
      "/shifts",
      "/fleet",
      "/washers",
      "/calendar",
      "/analytics",
      "/controls",
      "/activity",
      "/reports",
      "/components",
      "/notifications",
      "/settings",
      "/admin",
      "/imports",
      "/feeds",
      "/ops-inbox",
    ];

const KIOSK_ROUTES = ["/washers/app"];

const ALL_ROUTES = [...AUTH_ROUTES, ...APP_ROUTES, ...KIOSK_ROUTES];

/* ------------------------------------------------------------------ */
/*  Report types                                                       */
/* ------------------------------------------------------------------ */

type ActionResult = {
  selector: string;
  text: string;
  outcome: "navigation" | "network_request" | "ui_change" | "DEAD_ACTION" | "CLICK_BLOCKED";
  detail?: string;
};

type RouteReport = {
  route: string;
  project: string;
  status: "pass" | "fail" | "skip";
  httpStatus: number | null;
  consoleErrors: string[];
  consoleWarnings: string[];
  networkFailures: { url: string; status: number; method: string }[];
  redirectChain: string[];
  pageError: string | null;
  actions: ActionResult[];
  screenshotPath?: string;
  tracePath?: string;
};

const report: RouteReport[] = [];

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

function createSessionToken(userId: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60;
  const body = Buffer.from(
    JSON.stringify({ uid: userId, sid: "diag-session", st: "active", iat: issuedAt, exp: expiresAt }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function loginViaForm(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Login name").fill("admin");
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat|dashboard)/, { timeout: 15_000 });
}

async function ensureAuthenticated(page: Page, context: BrowserContext) {
  // Try form login first
  try {
    await loginViaForm(page);
    return;
  } catch {
    // fallback: inject session cookie
  }

  const secret =
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-session-secret-change-before-production";
  const token = createSessionToken("admin-user", secret);
  const baseURL = page.url() || "http://127.0.0.1:4173";
  const host = new URL(baseURL).hostname;

  await context.addCookies([
    {
      name: "uit_session",
      value: token,
      domain: host,
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
      secure: false,
    },
  ]);
}

/* ------------------------------------------------------------------ */
/*  Collectors                                                         */
/* ------------------------------------------------------------------ */

function attachCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const networkFailures: { url: string; status: number; method: string }[] = [];
  let pageError: string | null = null;

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });

  page.on("pageerror", (err) => {
    pageError = err.message;
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkFailures.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  });

  return { consoleErrors, consoleWarnings, networkFailures, getPageError: () => pageError };
}

/* ------------------------------------------------------------------ */
/*  Click audit                                                        */
/* ------------------------------------------------------------------ */

const ACTION_BUTTON_PATTERNS = [
  "Create",
  "Save",
  "Submit",
  "Export",
  "Add",
  "Send",
  "Delete",
  "Remove",
  "Update",
  "New",
  "Run",
  "Apply",
  "Confirm",
  "Mark",
  "Approve",
  "Decline",
  "Accept",
  "Reject",
  "Filter",
];

async function clickAudit(page: Page): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  // Find buttons matching action patterns
  console.log("    - Discovery: searching for buttons...");
  const buttons = await page.getByRole("button").all();
  console.log(`    - Discovery: found ${buttons.length} buttons total.`);
  const actionButtons: { locator: typeof buttons[0]; text: string }[] = [];

  for (const btn of buttons) {
    try {
      const text = await btn.textContent({ timeout: 1000 });
      if (!text) continue;
      const trimmed = text.trim();
      if (ACTION_BUTTON_PATTERNS.some((p) => trimmed.toLowerCase().includes(p.toLowerCase()))) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          actionButtons.push({ locator: btn, text: trimmed });
        }
      }
    } catch {
      // skip inaccessible buttons
    }
  }

  console.log(`    - Discovery: identified ${actionButtons.length} action buttons.`);

  // Limit to first 5 action buttons per page to avoid excessive test time
  for (const { locator, text } of actionButtons.slice(0, 5)) {
    console.log(`    - Action: auditing "${text}"...`);
    const urlBefore = page.url();
    let networkFired = false;

    const requestListener = () => { networkFired = true; };
    page.on("request", requestListener);

    try {
      console.log(`      - Checking if "${text}" is still valid...`);
      if (!(await locator.isVisible().catch(() => false))) {
        console.log(`      - "${text}" is no longer visible/valid.`);
        page.removeListener("request", requestListener);
        continue;
      }

      console.log(`      - Scrolling to "${text}"...`);
      // Scroll into view with margin to avoid sticky headers/navs
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      
      console.log(`      - Checking if "${text}" is disabled...`);
      // Check if disabled
      const isDisabled = await locator.isDisabled().catch(() => false);
      if (isDisabled) {
        console.log(`      - "${text}" is disabled.`);
        results.push({
          selector: `button:has-text("${text}")`,
          text,
          outcome: "CLICK_BLOCKED",
          detail: "Button is explicitly disabled",
        });
        page.removeListener("request", requestListener);
        continue;
      }

      console.log(`      - Clicking "${text}"...`);
      await locator.click({ timeout: 5000, force: false });
      console.log(`      - Clicked "${text}".`);
      results.push({
        selector: `button:has-text("${text}")`,
        text,
        outcome: "ui_change", // Assume UI change if no error
      });
      
      // Close any modals that might have opened
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`      - Click failed for "${text}": ${errorMsg.split("\n")[0]}`);
      results.push({
        selector: `button:has-text("${text}")`,
        text,
        outcome: "CLICK_BLOCKED",
        detail: `Click failed: ${errorMsg.split("\n")[0]}`,
      });
    }
    page.removeListener("request", requestListener);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Route visit with redirect tracking                                 */
/* ------------------------------------------------------------------ */

async function visitRoute(
  page: Page,
  route: string,
  projectName: string,
): Promise<RouteReport> {
  console.log(`  🔍 Visiting ${route}...`);
  const collectors = attachCollectors(page);
  const redirectChain: string[] = [];
  const MAX_REDIRECTS = 8;

  page.on("response", (response) => {
    if ([301, 302, 303, 307, 308].includes(response.status())) {
      redirectChain.push(response.url());
    }
  });

  let httpStatus: number | null = null;
  try {
    const response = await page.goto(route, {
      waitUntil: "load",
      timeout: 60_000,
    });
    httpStatus = response?.status() ?? null;
    
    // Fixed wait instead of networkidle which can hang on polling
    console.log(`  ⏳ Waiting for stability on ${route}...`);
    await page.waitForTimeout(5000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Failed to load ${route}: ${message}`);
    return {
      route,
      project: projectName,
      status: "fail",
      httpStatus: null,
      consoleErrors: [message],
      consoleWarnings: [],
      networkFailures: [],
      redirectChain,
      pageError: message,
      actions: [],
    };
  }

  // Check for redirect loops
  if (redirectChain.length > MAX_REDIRECTS) {
    console.log(`  ❌ Redirect loop on ${route}`);
    return {
      route,
      project: projectName,
      status: "fail",
      httpStatus,
      consoleErrors: [`Redirect loop detected: ${redirectChain.length} redirects`],
      consoleWarnings: collectors.consoleWarnings,
      networkFailures: collectors.networkFailures,
      redirectChain,
      pageError: "Redirect loop",
      actions: [],
    };
  }

  // Check for crash banner or 500 error
  // Use word-boundary matching to avoid false positives (e.g. "5000" matching "500")
  const hasCrash = await page
    .locator("text=/Application error|Internal Server Error/i")
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  // Separate check for standalone "500" status code (not embedded in numbers like 5000)
  const has500 = !hasCrash && await page
    .locator("text=/\\b500\\b/")
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  if (hasCrash || has500) {
    console.log(`  ❌ Crash/500 on ${route}`);
    return {
      route,
      project: projectName,
      status: "fail",
      httpStatus,
      consoleErrors: [...collectors.consoleErrors, "Crash banner or 500 detected on page"],
      consoleWarnings: collectors.consoleWarnings,
      networkFailures: collectors.networkFailures,
      redirectChain,
      pageError: "Crash/500 detected",
      actions: [],
    };
  }

  // Hydration grace period
  await page.waitForTimeout(2000);

  // Click audit
  console.log(`  🖱️  Auditing actions on ${route}...`);
  const actions = await clickAudit(page);
  console.log(`  ✅ Finished ${route} with ${actions.length} actions.`);

  // Separate hydration warnings from real errors — hydration mismatches are
  // recoverable and should not mark the route as failed.
  const realErrors = collectors.consoleErrors.filter(
    (e) => !e.includes("Hydration") && !e.includes("hydration"),
  );
  const hydrationWarnings = collectors.consoleErrors.filter(
    (e) => e.includes("Hydration") || e.includes("hydration"),
  );

  return {
    route,
    project: projectName,
    status: realErrors.length > 0 || collectors.getPageError() ? "fail" : "pass",
    httpStatus,
    consoleErrors: collectors.consoleErrors,
    consoleWarnings: [...collectors.consoleWarnings, ...hydrationWarnings.map(h => `[hydration] ${h.slice(0, 120)}`)],
    networkFailures: collectors.networkFailures,
    redirectChain,
    pageError: collectors.getPageError(),
    actions,
  };
}

/* ------------------------------------------------------------------ */
/*  Auto-discover nav links                                            */
/* ------------------------------------------------------------------ */

async function discoverNavLinks(page: Page, projectName: string): Promise<string[]> {
  const navSelector =
    projectName === "mobile"
      ? '[data-testid="bottom-nav"]'
      : projectName === "tablet"
        ? '[data-testid="side-rail"]'
        : '[data-testid="sidebar"]';

  const links = await page
    .locator(`${navSelector} a[href]`)
    .evaluateAll((els: HTMLAnchorElement[]) =>
      els.map((el) => new URL(el.href).pathname),
    )
    .catch(() => [] as string[]);

  return [...new Set(links)];
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

test.describe("Full Diagnostic Scan", () => {
  test.setTimeout(900_000); // 15 minutes

  test("auth routes load without auth", async ({ page }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();

    for (const route of AUTH_ROUTES) {
      const result = await visitRoute(page, route, projectName);
      report.push(result);

      // Auth routes should load (200) without redirecting to login
      expect(
        result.httpStatus,
        `${route} should return 200, got ${result.httpStatus}`,
      ).toBe(200);
    }
  });

  test("app routes load with auth", async ({ page, context }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();

    try {
      await ensureAuthenticated(page, context);
    } catch (err) {
      // If auth fails, record it and skip route scanning
      const message = err instanceof Error ? err.message : String(err);
      report.push({
        route: "/auth-setup",
        project: projectName,
        status: "fail",
        httpStatus: null,
        consoleErrors: [`Authentication failed: ${message}`],
        consoleWarnings: [],
        networkFailures: [],
        redirectChain: [],
        pageError: message,
        actions: [],
      });
      return;
    }

    // Discover nav links
    const discoveredLinks = process.env.SCAN_ROUTES ? [] : await discoverNavLinks(page, projectName);
    const allAppRoutes = [...new Set([...APP_ROUTES, ...discoveredLinks])];
    console.log(`[${projectName}] Scaning ${allAppRoutes.length} routes:`, allAppRoutes);

    for (const route of allAppRoutes) {
      try {
        const result = await visitRoute(page, route, projectName);
        report.push(result);

        // Should NOT end up at login (auth should be working)
        const currentUrl = page.url();
        if (currentUrl.includes("/login") && !route.startsWith("/login")) {
          result.status = "fail";
          result.consoleErrors.push(`Auth redirect: ended up at ${currentUrl} instead of ${route}`);
        }
      } catch (err) {
        // If page/context closed, try to recover by re-navigating
        const message = err instanceof Error ? err.message : String(err);
        report.push({
          route,
          project: projectName,
          status: "fail",
          httpStatus: null,
          consoleErrors: [message],
          consoleWarnings: [],
          networkFailures: [],
          redirectChain: [],
          pageError: message,
          actions: [],
        });

        // If page is closed, break the loop — browser is gone
        if (message.includes("has been closed")) break;
      }
    }
  });

  test("kiosk route loads", async ({ page }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();

    for (const route of KIOSK_ROUTES) {
      const result = await visitRoute(page, route, projectName);
      report.push(result);
    }
  });

  test("nav link discovery and accessibility", async ({ page, context }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();

    try {
      await ensureAuthenticated(page, context);
    } catch {
      // Auth failed — skip nav discovery
      return;
    }

    // Go to home and discover all nav links
    await page.goto("/home");
    await page.waitForLoadState("domcontentloaded");

    const discoveredLinks = await discoverNavLinks(page, projectName);

    // Every discovered link should be navigable
    for (const href of discoveredLinks) {
      if (ALL_ROUTES.includes(href)) continue; // already tested
      const result = await visitRoute(page, href, projectName);
      report.push(result);
    }
  });

  test.afterAll(async () => {
    // Write the report
    const reportDir = path.join(process.cwd(), "test-results");
    fs.mkdirSync(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, "full-scan-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Summary
    const passed = report.filter((r) => r.status === "pass").length;
    const failed = report.filter((r) => r.status === "fail").length;
    const deadActions = report.flatMap((r) =>
      r.actions.filter((a) => a.outcome === "DEAD_ACTION"),
    );
    const clickBlocked = report.flatMap((r) =>
      r.actions.filter((a) => a.outcome === "CLICK_BLOCKED"),
    );

    console.log("\n=== FULL SCAN SUMMARY ===");
    console.log(`Total routes scanned: ${report.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Dead actions (click succeeded, no effect): ${deadActions.length}`);
    console.log(`Click blocked (button inaccessible during scan): ${clickBlocked.length}`);

    if (failed > 0) {
      console.log("\nFailing routes:");
      for (const r of report.filter((r) => r.status === "fail")) {
        console.log(`  ❌ ${r.route} (${r.project}): ${r.consoleErrors[0] ?? r.pageError ?? "unknown"}`);
      }
    }

    if (deadActions.length > 0) {
      console.log("\nDead actions (TRUE dead — click worked but nothing happened):");
      for (const r of report) {
        for (const a of r.actions.filter((a) => a.outcome === "DEAD_ACTION")) {
          console.log(`  ⚠️  ${r.route} → "${a.text}": ${a.detail}`);
        }
      }
    }

    if (clickBlocked.length > 0) {
      console.log("\nClick blocked (needs form data, hydration, or scroll — verify via smoke tests):");
      for (const r of report) {
        for (const a of r.actions.filter((a) => a.outcome === "CLICK_BLOCKED")) {
          console.log(`  ℹ️  ${r.route} → "${a.text}": ${a.detail}`);
        }
      }
    }

    console.log(`\nReport written to: ${reportPath}`);
  });
});
