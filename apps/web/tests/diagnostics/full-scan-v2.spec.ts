/**
 * Full Truth Scanner v2 — visits every app route on Desktop / Tablet / Mobile,
 * captures console errors, network failures, redirect chains, and audits 
 * ACTION COVERAGE for primary controls.
 */
import { expect, test, type Page, type BrowserContext, type Locator } from "@playwright/test";
import { createHmac } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/* ------------------------------------------------------------------ */
/*  Route discovery                                                    */
/* ------------------------------------------------------------------ */

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const APP_ROUTES = [
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

/* ------------------------------------------------------------------ */
/*  Report types                                                       */
/* ------------------------------------------------------------------ */

type ActionResult = {
  text: string;
  selector: string;
  outcome: "navigation" | "network_request" | "modal_open" | "toast_appeared" | "DEAD_ACTION" | "CLICK_BLOCKED";
  detail?: string;
  evidence?: string;
};

type RouteReport = {
  route: string;
  project: string;
  status: "pass" | "fail";
  httpStatus: number | null;
  consoleErrors: string[];
  networkFailures: { url: string; status: number; method: string; bodySnippet?: string }[];
  redirectChain: string[];
  pageError: string | null;
  actions: ActionResult[];
  screenshotPath?: string;
};

const report: RouteReport[] = [];

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

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
  } catch {
    // fallback: inject cookie
    const secret = process.env.SESSION_SECRET || "ci-session-secret-change-before-production-32";
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 60 * 60;
    const body = Buffer.from(
      JSON.stringify({ uid: "admin-user", sid: "diag-session", st: "active", iat: issuedAt, exp: expiresAt }),
    ).toString("base64url");
    const signature = createHmac("sha256", secret).update(body).digest("base64url");
    const token = `${body}.${signature}`;
    
    const host = new URL(page.url() || "http://127.0.0.1:4173").hostname;
    await context.addCookies([{
      name: "uit_session",
      value: token,
      domain: host,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    }]);
  }
}

/* ------------------------------------------------------------------ */
/*  Action Audit                                                       */
/* ------------------------------------------------------------------ */

const PRIMARY_ACTION_PATTERNS = [
  "Create", "Save", "Update", "Delete", "Upload", "Import", 
  "Run", "Apply", "Confirm", "New", "Add", "Send", "Ack"
];

async function auditActions(page: Page, route: string): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  const buttons = await page.getByRole("button").all();
  
  const candidates: { locator: Locator; text: string }[] = [];
  for (const btn of buttons) {
    const text = (await btn.textContent().catch(() => ""))?.trim() || "";
    if (PRIMARY_ACTION_PATTERNS.some(p => text.toLowerCase().includes(p.toLowerCase()))) {
      if (await btn.isVisible().catch(() => false)) {
        candidates.push({ locator: btn, text });
      }
    }
  }

  console.log(`    - Found ${candidates.length} primary action candidates on ${route}`);

  // Audit up to 3 candidates to keep it fast
  for (const { locator, text } of candidates.slice(0, 3)) {
    console.log(`    - Auditing action: "${text}"`);
    
    // Check if blocked
    const pointerEvents = await locator.evaluate(el => window.getComputedStyle(el).pointerEvents);
    if (pointerEvents === "none") {
      results.push({ text, selector: "button", outcome: "CLICK_BLOCKED", detail: "pointer-events: none" });
      continue;
    }

    const isDisabled = await locator.isDisabled();
    if (isDisabled) {
      results.push({ text, selector: "button", outcome: "CLICK_BLOCKED", detail: "disabled attribute set" });
      continue;
    }

    // Monitor for effects
    let effectDetected: ActionResult["outcome"] | null = null;
    const urlBefore = page.url();
    
    const [response] = await Promise.allSettled([
      page.waitForResponse(r => r.request().method() !== "GET", { timeout: 3000 }),
      locator.click({ timeout: 3000 }).catch(e => {
        console.log(`      - Click failed: ${e.message}`);
        return null;
      })
    ]);

    if (page.url() !== urlBefore) effectDetected = "navigation";
    else if (response.status === "fulfilled") effectDetected = "network_request";
    else if (await page.locator("role=dialog").isVisible().catch(() => false)) effectDetected = "modal_open";
    else if (await page.locator("text=/success|created|updated|deleted|saved|sent/i").isVisible().catch(() => false)) effectDetected = "toast_appeared";

    if (effectDetected) {
      results.push({ text, selector: "button", outcome: effectDetected });
    } else {
      results.push({ text, selector: "button", outcome: "DEAD_ACTION", detail: "Clicked but no visible side effect detected in 3s" });
    }

    // Cleanup: close modals/toasts if any
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Route Runner                                                       */
/* ------------------------------------------------------------------ */

async function visitAndAudit(page: Page, route: string, projectName: string): Promise<RouteReport> {
  const consoleErrors: string[] = [];
  const networkFailures: RouteReport["networkFailures"] = [];
  let pageError: string | null = null;

  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => { pageError = err.message; });
  page.on("response", async res => {
    if (res.status() >= 400) {
      let bodySnippet = "";
      try { bodySnippet = (await res.text()).slice(0, 200); } catch {}
      networkFailures.push({ url: res.url(), status: res.status(), method: res.request().method(), bodySnippet });
    }
  });

  const redirectChain: string[] = [];
  page.on("response", res => { if ([301, 302, 307, 308].includes(res.status())) redirectChain.push(res.url()); });

  let httpStatus: number | null = null;
  try {
    const res = await page.goto(route, { waitUntil: "load", timeout: 30000 });
    httpStatus = res?.status() ?? null;
    await page.waitForTimeout(2000); // Wait for hydration
  } catch (e: unknown) {
    pageError = e instanceof Error ? e.message : String(e);
  }

  let actions: ActionResult[] = [];
  if (!pageError && httpStatus && httpStatus < 400 && redirectChain.length < 10) {
    actions = await auditActions(page, route);
  }

  const hasCrash = await page.locator("text=/Application error|Internal Server Error|500/i").isVisible({ timeout: 500 }).catch(() => false);
  
  const status = (!pageError && !hasCrash && httpStatus && httpStatus < 400 && redirectChain.length < 10 && !consoleErrors.some(e => !e.includes("hydration"))) ? "pass" : "fail";

  return {
    route,
    project: projectName,
    status,
    httpStatus,
    consoleErrors,
    networkFailures,
    redirectChain,
    pageError,
    actions,
  };
}

/* ------------------------------------------------------------------ */
/*  Main Tests                                                         */
/* ------------------------------------------------------------------ */

test.describe("Truth Scanner v2", () => {
  test.setTimeout(600_000);

  test("full route and action audit", async ({ page, context }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();
    
    // 1. Auth routes (no auth)
    for (const route of AUTH_ROUTES) {
      const res = await visitAndAudit(page, route, projectName);
      report.push(res);
    }

    // 2. App routes (with auth)
    await ensureAuthenticated(page, context);
    for (const route of APP_ROUTES) {
      const res = await visitAndAudit(page, route, projectName);
      report.push(res);
    }

    // 3. Kiosk routes
    for (const route of KIOSK_ROUTES) {
      const res = await visitAndAudit(page, route, projectName);
      report.push(res);
    }
  });

  test.afterAll(async () => {
    const reportDir = path.join(process.cwd(), "test-results");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, "full-scan-v2-report.json"), JSON.stringify(report, null, 2));
    
    console.log("\n--- Truth Scanner v2 Summary ---");
    console.log(`Routes scanned: ${report.length}`);
    console.log(`Passed: ${report.filter(r => r.status === "pass").length}`);
    console.log(`Failed: ${report.filter(r => r.status === "fail").length}`);
    const dead = report.flatMap(r => r.actions.filter(a => a.outcome === "DEAD_ACTION"));
    console.log(`Dead actions: ${dead.length}`);
  });
});
