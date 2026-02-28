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
// ALL_ROUTES is used for filtering out already scanned links if needed, but we omit it here since we don't need it.

/* ------------------------------------------------------------------ */
/*  Report types                                                       */
/* ------------------------------------------------------------------ */

type ActionResult = {
  selector: string;
  text: string;
  outcome: "navigation" | "network_request" | "modal_open" | "toast_alert" | "list_change" | "DEAD_ACTION" | "CLICK_BLOCKED";
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
  try {
    await loginViaForm(page);
    return;
  } catch {
    // fallback
  }

  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-session-secret-change-before-production";
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

  const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning") consoleWarnings.push(msg.text());
  };

  const onPageError = (err: Error) => {
    pageError = err.message;
  };

  const onResponse = (response: import("@playwright/test").Response) => {
    if (response.status() >= 400) {
      networkFailures.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
      });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  return { 
    consoleErrors, 
    consoleWarnings, 
    networkFailures, 
    getPageError: () => pageError,
    cleanup: () => {
      page.removeListener("console", onConsole);
      page.removeListener("pageerror", onPageError);
      page.removeListener("response", onResponse);
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Click audit                                                        */
/* ------------------------------------------------------------------ */

const ACTION_BUTTON_PATTERNS = [
  "Create", "Save", "Submit", "Export", "Add", "Send", "Delete", "Remove",
  "Update", "New", "Run", "Apply", "Confirm", "Mark", "Approve", "Decline",
  "Accept", "Reject", "Filter", "Import", "Upload"
];

async function clickAudit(page: Page): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  console.log("    - Discovery: searching for buttons...");
  const buttons = await page.getByRole("button").all();
  const actionButtons: { locator: typeof buttons[0]; text: string }[] = [];

  for (const btn of buttons) {
    try {
      const text = await btn.textContent({ timeout: 1000 });
      if (!text) continue;
      const trimmed = text.trim();
      if (ACTION_BUTTON_PATTERNS.some((p) => trimmed.toLowerCase().includes(p.toLowerCase()))) {
        if (await btn.isVisible().catch(() => false)) {
          actionButtons.push({ locator: btn, text: trimmed });
        }
      }
    } catch {
      // skip
    }
  }

  console.log(`    - Discovery: identified ${actionButtons.length} action buttons.`);

  for (const { locator, text } of actionButtons.slice(0, 5)) {
    console.log(`    - Action: auditing "${text}"...`);
    let networkRequestFired = false;
    const requestListener = (req: import("@playwright/test").Request) => {
      // Ignore analytic/metric requests
      if (!req.url().includes("metric") && req.method() !== "OPTIONS") {
        networkRequestFired = true;
      }
    };
    page.on("request", requestListener);

    try {
      if (!(await locator.isVisible().catch(() => false))) {
        page.removeListener("request", requestListener);
        continue;
      }

      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      if (await locator.isDisabled().catch(() => false)) {
        results.push({
          selector: `button:has-text("${text}")`,
          text,
          outcome: "CLICK_BLOCKED",
          detail: "Button is explicitly disabled",
        });
        page.removeListener("request", requestListener);
        continue;
      }

      // Check for HTML5 form validation if it's a submit button
      const isSubmit = await locator.evaluate((btn) => (btn as HTMLButtonElement).type === "submit").catch(() => false);
      if (isSubmit) {
        const formInvalid = await locator.evaluate((btn) => {
          const form = (btn as HTMLButtonElement).form;
          return form && !form.checkValidity();
        }).catch(() => false);
        
        if (formInvalid) {
          results.push({
            selector: `button:has-text("${text}")`,
            text,
            outcome: "CLICK_BLOCKED",
            detail: "Form has invalid/required fields (HTML5 validation)",
          });
          page.removeListener("request", requestListener);
          continue;
        }
      }

      const initialUrl = page.url();
      const initialModals = await page.getByRole("dialog").count();
      const initialToasts = await page.getByRole("alert").count();
      const initialListItems = await page.getByRole("listitem").count();

      await locator.click({ timeout: 5000, force: false });
      
      // Wait for potential effects
      await page.waitForTimeout(1000);
      
      const newUrl = page.url();
      const newModals = await page.getByRole("dialog").count();
      const newToasts = await page.getByRole("alert").count();
      const newListItems = await page.getByRole("listitem").count();

      if (newUrl !== initialUrl) {
        results.push({ selector: `button:has-text("${text}")`, text, outcome: "navigation" });
        console.log(`      - Navigated to ${newUrl}. Stopping further clicks on this route.`);
        page.removeListener("request", requestListener);
        break; // Stop auditing further buttons because we left the page
      } else if (newModals > initialModals) {
        results.push({ selector: `button:has-text("${text}")`, text, outcome: "modal_open" });
      } else if (newToasts > initialToasts) {
        results.push({ selector: `button:has-text("${text}")`, text, outcome: "toast_alert" });
      } else if (newListItems !== initialListItems) {
        results.push({ selector: `button:has-text("${text}")`, text, outcome: "list_change" });
      } else if (networkRequestFired) {
        results.push({ selector: `button:has-text("${text}")`, text, outcome: "network_request" });
      } else {
        results.push({
          selector: `button:has-text("${text}")`,
          text,
          outcome: "DEAD_ACTION",
          detail: "No navigation, network mutation, modal, toast, or list change detected."
        });
      }

      // Close any modals that might have opened
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
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

async function visitRoute(page: Page, route: string, projectName: string): Promise<RouteReport> {
  console.log(`  🔍 Visiting ${route}...`);
  const collectors = attachCollectors(page);
  const redirectChain: string[] = [];
  const MAX_REDIRECTS = 8;

  const onRedirect = (response: import("@playwright/test").Response) => {
    if ([301, 302, 303, 307, 308].includes(response.status())) {
      redirectChain.push(response.url());
    }
  };
  page.on("response", onRedirect);

  const cleanup = () => {
    collectors.cleanup();
    page.removeListener("response", onRedirect);
  };

  let httpStatus: number | null = null;
  try {
    const response = await page.goto(route, { waitUntil: "load", timeout: 60_000 });
    httpStatus = response?.status() ?? null;
    await page.waitForTimeout(5000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Failed to load ${route}: ${message}`);
    cleanup();
    return {
      route, project: projectName, status: "fail", httpStatus: null,
      consoleErrors: [message], consoleWarnings: [], networkFailures: [],
      redirectChain, pageError: message, actions: [],
    };
  }

  if (redirectChain.length > MAX_REDIRECTS) {
    console.log(`  ❌ Redirect loop on ${route}`);
    cleanup();
    return {
      route, project: projectName, status: "fail", httpStatus,
      consoleErrors: [`Redirect loop detected: ${redirectChain.length} redirects`],
      consoleWarnings: collectors.consoleWarnings, networkFailures: collectors.networkFailures,
      redirectChain, pageError: "Redirect loop", actions: [],
    };
  }

  const hasCrash = await page.locator("text=/Application error|Internal Server Error/i").first().isVisible({ timeout: 2000 }).catch(() => false);
  const has500 = !hasCrash && await page.locator("text=/\\b500\\b/").first().isVisible({ timeout: 1000 }).catch(() => false);

  if (hasCrash || has500) {
    console.log(`  ❌ Crash/500 on ${route}`);
    cleanup();
    return {
      route, project: projectName, status: "fail", httpStatus,
      consoleErrors: [...collectors.consoleErrors, "Crash banner or 500 detected on page"],
      consoleWarnings: collectors.consoleWarnings, networkFailures: collectors.networkFailures,
      redirectChain, pageError: "Crash/500 detected", actions: [],
    };
  }

  await page.waitForTimeout(2000);
  console.log(`  🖱️  Auditing actions on ${route}...`);
  const actions = await clickAudit(page);
  console.log(`  ✅ Finished ${route} with ${actions.length} actions.`);

  cleanup();

  const realErrors = collectors.consoleErrors.filter((e) => !e.includes("Hydration") && !e.includes("hydration"));
  const hydrationWarnings = collectors.consoleErrors.filter((e) => e.includes("Hydration") || e.includes("hydration"));

  return {
    route, project: projectName, status: realErrors.length > 0 || collectors.getPageError() ? "fail" : "pass",
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

async function discoverNavLinks(page: Page): Promise<string[]> {
  const selectors = [
    '[data-testid="bottom-nav"]',
    '[data-testid="side-rail"]',
    '[data-testid="sidebar"]',
    'nav',
    'header'
  ];
  
  let links: string[] = [];
  for (const selector of selectors) {
    const found = await page.locator(`${selector} a[href]`).evaluateAll((els: HTMLAnchorElement[]) =>
      els.map((el) => {
        try { return new URL(el.href).pathname; } catch { return null; }
      }).filter(Boolean) as string[]
    ).catch(() => [] as string[]);
    links = [...links, ...found];
  }
  return [...new Set(links)];
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

test.describe("Full Diagnostic Scan V2", () => {
  test.setTimeout(900_000); // 15 minutes

  test("auth routes load without auth", async ({ page }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();
    for (const route of AUTH_ROUTES) {
      const result = await visitRoute(page, route, projectName);
      report.push(result);
      expect(result.httpStatus, `${route} should return 200`).toBe(200);
    }
  });

  test("app routes load with auth", async ({ page, context }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();

    try {
      await ensureAuthenticated(page, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.push({
        route: "/auth-setup", project: projectName, status: "fail", httpStatus: null,
        consoleErrors: [`Authentication failed: ${message}`], consoleWarnings: [],
        networkFailures: [], redirectChain: [], pageError: message, actions: [],
      });
      return;
    }

    const discoveredLinks = process.env.SCAN_ROUTES ? [] : await discoverNavLinks(page);
    const allAppRoutes = [...new Set([...APP_ROUTES, ...discoveredLinks])];
    console.log(`[${projectName}] Scaning ${allAppRoutes.length} routes:`, allAppRoutes);

    for (const route of allAppRoutes) {
      try {
        const result = await visitRoute(page, route, projectName);
        report.push(result);
        if (page.url().includes("/login") && !route.startsWith("/login")) {
          result.status = "fail";
          result.consoleErrors.push(`Auth redirect: ended up at ${page.url()} instead of ${route}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        report.push({
          route, project: projectName, status: "fail", httpStatus: null,
          consoleErrors: [message], consoleWarnings: [], networkFailures: [],
          redirectChain: [], pageError: message, actions: [],
        });
        if (message.includes("has been closed")) break;
      }
    }
  });

  test("kiosk route loads", async ({ page }, testInfo) => {
    const projName = testInfo.project.name.toLowerCase();
    for (const route of KIOSK_ROUTES) {
      const result = await visitRoute(page, route, projName);
      report.push(result);
    }
  });

  test.afterAll(async () => {
    const reportDir = path.join(process.cwd(), "test-results");
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, "full-scan-v2-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const passed = report.filter((r) => r.status === "pass").length;
    const failed = report.filter((r) => r.status === "fail").length;
    const deadActions = report.flatMap((r) => r.actions.filter((a) => a.outcome === "DEAD_ACTION"));
    const clickBlocked = report.flatMap((r) => r.actions.filter((a) => a.outcome === "CLICK_BLOCKED"));

    console.log("\n=== FULL SCAN V2 SUMMARY ===");
    console.log(`Total routes scanned: ${report.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Dead actions: ${deadActions.length}`);
    console.log(`Click blocked: ${clickBlocked.length}`);

    if (failed > 0) {
      console.log("\nFailing routes:");
      for (const r of report.filter((r) => r.status === "fail")) {
        console.log(`  ❌ ${r.route} (${r.project}): ${r.consoleErrors[0] ?? r.pageError ?? "unknown"}`);
      }
    }
    if (deadActions.length > 0) {
      console.log("\nDead actions:");
      for (const r of report) {
        for (const a of r.actions.filter((a) => a.outcome === "DEAD_ACTION")) {
          console.log(`  ⚠️  ${r.route} → "${a.text}": ${a.detail}`);
        }
      }
    }
    console.log(`\nReport written to: ${reportPath}`);
  });
});
