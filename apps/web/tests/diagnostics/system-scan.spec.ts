import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const AUTH_ROUTE_HINTS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
]);

const ACTION_VERBS = [
  "Create",
  "Save",
  "Update",
  "Delete",
  "Upload",
  "Import",
  "Run",
  "Apply",
  "Confirm",
  "Add",
  "New",
  "Export",
];
const ACTION_VERB_PATTERN = new RegExp(
  `\\b(${ACTION_VERBS.map((verb) => escapeRegExp(verb)).join("|")})\\b`,
  "i",
);

const MAX_ROUTE_REDIRECTS = 10;
const MAX_ACTIONS_PER_ROUTE = 2;
const SYSTEM_SCAN_REPORT_FILE =
  process.env.SYSTEM_SCAN_REPORT_FILE?.trim() || "system-scan-report.json";
const ROUTE_LOAD_TIMEOUT_MS = 30_000;
const ROUTE_FALLBACK_TIMEOUT_MS = 20_000;
const ROUTE_READY_TIMEOUT_MS = 12_000;
const ACTION_NAV_TIMEOUT_MS = 20_000;
const ACTION_READY_TIMEOUT_MS = 8_000;
const HYDRATION_MISMATCH_PATTERN =
  /hydrated but some attributes of the server rendered html didn't match|hydration mismatch/i;

const ROUTE_READY_SELECTORS: Record<string, string[]> = {
  "/fleet": ['[data-testid="fleet-page"]', '[data-testid="fleet-blocked"]', 'h1:has-text("Fleet")'],
  "/washers": ['[data-testid="washers-page"]', '[data-testid="washers-blocked"]', 'h1:has-text("Washer Operations")'],
  "/settings": ['[data-testid="settings-page"]', 'h1:has-text("Settings")'],
  "/notifications": ['[data-testid="notifications-page"]', 'h1:has-text("Notifications")'],
  "/overview": ['[data-testid="home-page"]', 'h1:has-text("Overview")'],
};

const DEFAULT_READY_SELECTORS = ['[data-shell-root="true"]', "main", "[data-testid$='-page']", "h1"];

type FailedRequest = {
  url: string;
  status: number;
  method: string;
};

type ActionOutcome =
  | "navigation"
  | "network_mutation"
  | "modal_open"
  | "toast_or_alert"
  | "list_change"
  | "DEAD_ACTION"
  | "CLICK_BLOCKED"
  | "SKIPPED";

type ActionAudit = {
  text: string;
  role: "button" | "link";
  outcome: ActionOutcome;
  detail?: string;
};

type RouteScanResult = {
  project: string;
  route: string;
  status: "pass" | "fail";
  httpStatus: number | null;
  finalUrl: string | null;
  redirectChain: string[];
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  deadActions: ActionAudit[];
  actions: ActionAudit[];
  bannerDetected: boolean;
  hydrationMismatch: boolean;
  errorId?: string;
  requestId?: string;
  screenshotPath?: string;
  tracePath?: string;
};

type ActionCandidate = {
  role: "button" | "link";
  text: string;
};

function relativeRouteKey(route: string) {
  return route
    .replace(/[^\w/-]+/g, "-")
    .replace(/\//g, "_")
    .replace(/^_+/, "")
    .replace(/_+/g, "_")
    .replace(/^-+|-+$/g, "") || "root";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRoutePath(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  let pathname: string;
  try {
    pathname = new URL(input, "http://127.0.0.1:4173").pathname;
  } catch {
    return null;
  }

  if (!pathname.startsWith("/")) {
    return null;
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets")
  ) {
    return null;
  }

  if (pathname.includes("[") || pathname.includes("]")) {
    return null;
  }

  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return pathname;
}

function createSessionToken(userId: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60;
  const body = Buffer.from(
    JSON.stringify({ uid: userId, sid: "diagnostic-session", st: "active", iat: issuedAt, exp: expiresAt }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function loginViaForm(page: Page) {
  await page.goto("/login", { waitUntil: "load", timeout: 60_000 });
  await page.getByLabel("Login name").fill("admin");
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat|dashboard)/, { timeout: 20_000 });
}

async function ensureAuthenticated(page: Page, context: BrowserContext) {
  try {
    await loginViaForm(page);
    return;
  } catch {
    // Fallback to signed cookie for local deterministic diagnostics.
  }

  const secret =
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-session-secret-change-before-production";

  const token = createSessionToken("admin-user", secret);
  const base = page.url() || "http://127.0.0.1:4173";
  const domain = new URL(base).hostname;

  await context.addCookies([
    {
      name: "uit_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
      secure: false,
    },
  ]);

  await page.goto("/overview", { waitUntil: "load", timeout: 60_000 });
}

function resolveAppDirectory() {
  const cwd = process.cwd();
  const direct = path.join(cwd, "app");
  if (fs.existsSync(path.join(direct, "page.tsx"))) {
    return direct;
  }

  const nested = path.join(cwd, "apps", "web", "app");
  if (fs.existsSync(path.join(nested, "page.tsx"))) {
    return nested;
  }

  throw new Error(`Unable to resolve Next app directory from ${cwd}`);
}

function walkPageFiles(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPageFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name === "page.tsx") {
      files.push(fullPath);
    }
  }

  return files;
}

function routeFromPageFile(appDir: string, filePath: string) {
  const relative = path.relative(appDir, filePath).replace(/\\/g, "/");
  if (relative === "page.tsx") {
    return "/";
  }

  if (!relative.endsWith("/page.tsx")) {
    return null;
  }

  const routeSegments = relative
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("(") || !segment.endsWith(")"));

  if (routeSegments.length === 0) {
    return "/";
  }

  if (routeSegments.some((segment) => segment.includes("[") || segment.includes("]"))) {
    return null;
  }

  if (routeSegments.some((segment) => segment.startsWith("@"))) {
    return null;
  }

  return normalizeRoutePath(`/${routeSegments.join("/")}`);
}

function discoverFilesystemRoutes() {
  const appDir = resolveAppDirectory();
  const pageFiles = walkPageFiles(appDir);
  const routes = new Set<string>();

  for (const filePath of pageFiles) {
    const route = routeFromPageFile(appDir, filePath);
    if (route) {
      routes.add(route);
    }
  }

  routes.add("/washers/app");
  routes.add("/login");

  return [...routes].sort();
}

async function openNavigationDrawers(page: Page) {
  const toggles = [
    /open modules/i,
    /toggle sidebar/i,
    /expand sidebar/i,
    /open sidebar/i,
    /open menu/i,
  ];

  for (const pattern of toggles) {
    if (page.isClosed()) {
      return;
    }
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}

async function discoverUiRoutes(page: Page) {
  await openNavigationDrawers(page);

  const selectors = [
    "[data-testid='sidebar'] a[href]",
    "[data-testid='side-rail'] a[href]",
    "[data-testid='bottom-nav'] a[href]",
    "aside a[href]",
    "nav a[href]",
    "header a[href]",
    "[role='dialog'] a[href]",
  ];

  const routes = new Set<string>();

  for (const selector of selectors) {
    const found = await page
      .locator(selector)
      .evaluateAll((anchors: HTMLAnchorElement[]) => anchors.map((anchor) => anchor.getAttribute("href")))
      .catch(() => [] as Array<string | null>);

    for (const href of found) {
      const route = normalizeRoutePath(href);
      if (route) {
        routes.add(route);
      }
    }
  }

  return [...routes].sort();
}

function detectRedirectLoop(chain: string[]) {
  return chain.length > MAX_ROUTE_REDIRECTS;
}

async function waitForRouteReady(page: Page, route: string, timeoutMs: number) {
  const routeKey = normalizeRoutePath(page.url()) ?? normalizeRoutePath(route) ?? route;
  const selectors =
    ROUTE_READY_SELECTORS[routeKey] ??
    ROUTE_READY_SELECTORS[route] ??
    DEFAULT_READY_SELECTORS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const isVisible = await page
        .locator(selector)
        .first()
        .isVisible()
        .catch(() => false);
      if (isVisible) {
        return;
      }
    }
    await page.waitForTimeout(150);
  }

  throw new Error(
    `Route readiness timeout for ${routeKey}. Selectors: ${selectors.join(", ")}`,
  );
}

async function gotoRouteWithReadyState(
  page: Page,
  route: string,
  options?: { navTimeout?: number; fallbackTimeout?: number; readyTimeout?: number },
) {
  const navTimeout = options?.navTimeout ?? ROUTE_LOAD_TIMEOUT_MS;
  const fallbackTimeout = options?.fallbackTimeout ?? ROUTE_FALLBACK_TIMEOUT_MS;
  const readyTimeout = options?.readyTimeout ?? ROUTE_READY_TIMEOUT_MS;

  const response = await page
    .goto(route, { waitUntil: "domcontentloaded", timeout: navTimeout })
    .catch(async () => {
      return page.goto(route, { waitUntil: "commit", timeout: fallbackTimeout });
    });

  await waitForRouteReady(page, route, readyTimeout);
  return response;
}

function matchFirst(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

async function readCorrelationIdsFromPage(page: Page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return {
    errorId: matchFirst(bodyText, /Error ID:\s*([A-Za-z0-9._:-]+)/i),
    requestId: matchFirst(bodyText, /Request ID:\s*([A-Za-z0-9._:-]+)/i),
  };
}

async function hasErrorBanner(page: Page) {
  const candidates = [
    page.getByText(/Something went wrong/i).first(),
    page.getByText(/Application error/i).first(),
    page.getByText(/Internal Server Error/i).first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

function hasActionVerb(text: string) {
  return ACTION_VERB_PATTERN.test(text);
}

async function collectPrimaryActionCandidates(page: Page) {
  const pool = page.locator("button, a[href], [role='button']");
  const count = Math.min(await pool.count(), 300);
  const candidates: ActionCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const node = pool.nth(index);
    const visible = await node.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    const belongsToQuickBar = await node
      .evaluate((element) =>
        Boolean(
          element.closest(
            "[data-testid='quick-bar'], [data-testid='sidebar'], [data-testid='side-rail'], [data-testid='bottom-nav'], nav[aria-label='Module navigation']",
          ),
        ),
      )
      .catch(() => false);
    if (belongsToQuickBar) {
      continue;
    }

    const rawText = await node
      .innerText()
      .then((value) => value.replace(/\s+/g, " ").trim())
      .catch(() => "");
    if (/^new conversation$/i.test(rawText)) {
      continue;
    }
    if (!rawText || rawText.length > 120 || !hasActionVerb(rawText)) {
      continue;
    }

    const tagName = await node
      .evaluate((element) => element.tagName.toLowerCase())
      .catch(() => "button");
    const role: "button" | "link" = tagName === "a" ? "link" : "button";

    const key = `${role}:${rawText.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push({ role, text: rawText });

    if (candidates.length >= MAX_ACTIONS_PER_ROUTE) {
      break;
    }
  }

  return candidates;
}

function actionLocator(page: Page, candidate: ActionCandidate) {
  const pattern = new RegExp(escapeRegExp(candidate.text), "i");
  if (candidate.role === "link") {
    return page.getByRole("link", { name: pattern }).first();
  }
  return page.getByRole("button", { name: pattern }).first();
}

async function actionOutcome(page: Page, candidate: ActionCandidate, route: string): Promise<ActionAudit> {
  await gotoRouteWithReadyState(page, route, {
    navTimeout: ACTION_NAV_TIMEOUT_MS,
    fallbackTimeout: ACTION_NAV_TIMEOUT_MS,
    readyTimeout: ACTION_READY_TIMEOUT_MS,
  });
  await page.waitForTimeout(250);

  const locator = actionLocator(page, candidate);
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) {
    return {
      role: candidate.role,
      text: candidate.text,
      outcome: "SKIPPED",
      detail: "Target is not visible after route refresh.",
    };
  }

  if (await locator.isDisabled().catch(() => false)) {
    return {
      role: candidate.role,
      text: candidate.text,
      outcome: "SKIPPED",
      detail: "Target is disabled.",
    };
  }

  const hasDisabledSemantics = await locator
    .evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const ariaDisabled = element.getAttribute("aria-disabled");
      const dataDisabled = element.getAttribute("data-disabled");
      const pointerEvents = window.getComputedStyle(element).pointerEvents;
      return (
        ariaDisabled === "true" ||
        dataDisabled === "true" ||
        pointerEvents === "none"
      );
    })
    .catch(() => false);

  if (hasDisabledSemantics) {
    return {
      role: candidate.role,
      text: candidate.text,
      outcome: "SKIPPED",
      detail: "Target has disabled semantics.",
    };
  }

  if (candidate.role === "button") {
    const isSubmit = await locator
      .evaluate((element) => element instanceof HTMLButtonElement && element.type === "submit")
      .catch(() => false);
    if (isSubmit) {
      const formInvalid = await locator
        .evaluate((element) => {
          if (!(element instanceof HTMLButtonElement) || !element.form) {
            return false;
          }
          return !element.form.checkValidity();
        })
        .catch(() => false);

      if (formInvalid) {
        return {
          role: candidate.role,
          text: candidate.text,
          outcome: "SKIPPED",
          detail: "Submit action blocked by invalid form state.",
        };
      }
    }
  }

  const beforeUrl = page.url();
  const beforeDialogs = await page.getByRole("dialog").count();
  const beforeAlerts = await page.locator("[role='alert'], [role='status'], [data-sonner-toast]").count();
  const beforeRows =
    (await page.locator("[role='row']").count()) +
    (await page.locator("tbody tr, li, [role='listitem']").count());

  let mutationCount = 0;
  let requestCount = 0;
  const requestListener = (request: import("@playwright/test").Request) => {
    requestCount += 1;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method().toUpperCase())) {
      mutationCount += 1;
    }
  };
  page.on("request", requestListener);

  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
    await locator.click({ timeout: 4_000 });
  } catch (error) {
    page.removeListener("request", requestListener);
    const message = error instanceof Error ? error.message : String(error);
    return {
      role: candidate.role,
      text: candidate.text,
      outcome: "CLICK_BLOCKED",
      detail: message.split("\n")[0] ?? "Click blocked.",
    };
  }

  const navigated = await page
    .waitForURL((url) => url.toString() !== beforeUrl, {
      timeout: candidate.role === "link" ? 8_000 : 3_000,
    })
    .then(() => true)
    .catch(() => false);

  await page.waitForTimeout(500);
  page.removeListener("request", requestListener);

  const afterUrl = page.url();
  const afterDialogs = await page.getByRole("dialog").count();
  const afterAlerts = await page.locator("[role='alert'], [role='status'], [data-sonner-toast]").count();
  const afterRows =
    (await page.locator("[role='row']").count()) +
    (await page.locator("tbody tr, li, [role='listitem']").count());

  if (navigated || afterUrl !== beforeUrl) {
    return { role: candidate.role, text: candidate.text, outcome: "navigation" };
  }
  if (mutationCount > 0) {
    return { role: candidate.role, text: candidate.text, outcome: "network_mutation" };
  }
  if (/export/i.test(candidate.text) && requestCount > 0) {
    return { role: candidate.role, text: candidate.text, outcome: "network_mutation" };
  }
  if (afterDialogs > beforeDialogs) {
    return { role: candidate.role, text: candidate.text, outcome: "modal_open" };
  }
  if (afterAlerts > beforeAlerts) {
    return { role: candidate.role, text: candidate.text, outcome: "toast_or_alert" };
  }
  if (afterRows !== beforeRows) {
    return { role: candidate.role, text: candidate.text, outcome: "list_change" };
  }

  return {
    role: candidate.role,
    text: candidate.text,
    outcome: "DEAD_ACTION",
    detail: "No navigation, mutation request, modal, toast/alert, or list change detected.",
  };
}

function buildCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];
  const redirectChain: string[] = [];

  const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
    const text = message.text();
    if (message.type() === "error") {
      consoleErrors.push(text);
    } else if (message.type() === "warning") {
      consoleWarnings.push(text);
    }
  };

  const onPageError = (error: Error) => {
    pageErrors.push(error.message);
  };

  const onResponse = (response: import("@playwright/test").Response) => {
    if ([301, 302, 303, 307, 308].includes(response.status())) {
      const location = response.headers()["location"];
      redirectChain.push(location ? `${response.url()} -> ${location}` : response.url());
    }

    if (response.status() >= 400) {
      failedRequests.push({
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
    pageErrors,
    failedRequests,
    redirectChain,
    cleanup() {
      page.removeListener("console", onConsole);
      page.removeListener("pageerror", onPageError);
      page.removeListener("response", onResponse);
    },
  };
}

async function scanRoute(
  route: string,
  page: Page,
  testInfo: TestInfo,
  options?: { auditActions?: boolean },
) {
  const collectors = buildCollectors(page);
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let responseRequestId: string | undefined;
  let responseErrorId: string | undefined;
  const actions: ActionAudit[] = [];

  try {
    const response = await gotoRouteWithReadyState(page, route, {
      navTimeout: ROUTE_LOAD_TIMEOUT_MS,
      fallbackTimeout: ROUTE_FALLBACK_TIMEOUT_MS,
      readyTimeout: ROUTE_READY_TIMEOUT_MS,
    });
    httpStatus = response?.status() ?? null;
    finalUrl = page.url();
    responseRequestId = response?.headers()["x-request-id"];
    responseErrorId = response?.headers()["x-error-id"];
    await page.waitForTimeout(400);

    if (options?.auditActions !== false && !AUTH_ROUTE_HINTS.has(route)) {
      const candidates = await collectPrimaryActionCandidates(page);
      for (const candidate of candidates) {
        const audit = await actionOutcome(page, candidate, route);
        actions.push(audit);
      }
    }
  } catch (error) {
    collectors.pageErrors.push(error instanceof Error ? error.message : String(error));
  }

  const bannerDetected = await hasErrorBanner(page);
  const correlation = await readCorrelationIdsFromPage(page);
  const deadActions = actions.filter((entry) => entry.outcome === "DEAD_ACTION");
  const has500 =
    httpStatus === 500 ||
    collectors.failedRequests.some((request) => request.status >= 500);
  const redirectLoop = detectRedirectLoop(collectors.redirectChain);
  const hasUnhandledPageError = collectors.pageErrors.length > 0;
  const hydrationMismatch = collectors.consoleErrors.some((entry) =>
    HYDRATION_MISMATCH_PATTERN.test(entry),
  );

  const failed =
    has500 ||
    redirectLoop ||
    bannerDetected ||
    hasUnhandledPageError ||
    hydrationMismatch ||
    deadActions.length > 0;

  let screenshotPath: string | undefined;
  let tracePath: string | undefined;
  if (failed) {
    const evidenceDir = testInfo.outputPath("system-scan");
    fs.mkdirSync(evidenceDir, { recursive: true });
    const routeKey = relativeRouteKey(route);
    const screenshotAbsolute = path.join(evidenceDir, `${routeKey}.png`);
    await page.screenshot({ path: screenshotAbsolute, fullPage: true }).catch(() => {});
    screenshotPath = path.relative(process.cwd(), screenshotAbsolute);
    // Test-level Playwright trace is retained on failure by config; keep explicit path reference in report.
    tracePath = path.relative(process.cwd(), testInfo.outputPath("trace.zip"));
  }

  collectors.cleanup();

  const result: RouteScanResult = {
    project: testInfo.project.name.toLowerCase(),
    route,
    status: failed ? "fail" : "pass",
    httpStatus,
    finalUrl,
    redirectChain: collectors.redirectChain.slice(-20),
    consoleErrors: collectors.consoleErrors.slice(-20),
    consoleWarnings: collectors.consoleWarnings.slice(-20),
    pageErrors: collectors.pageErrors.slice(-20),
    failedRequests: collectors.failedRequests.slice(-20),
    deadActions,
    actions,
    bannerDetected,
    hydrationMismatch,
  };

  const errorId = correlation.errorId ?? responseErrorId;
  const requestId = correlation.requestId ?? responseRequestId;
  if (errorId) {
    result.errorId = errorId;
  }
  if (requestId) {
    result.requestId = requestId;
  }
  if (screenshotPath) {
    result.screenshotPath = screenshotPath;
  }
  if (tracePath) {
    result.tracePath = tracePath;
  }

  return result;
}

function writeSystemScanReport(entries: RouteScanResult[], projectName: string) {
  const reportDir = path.join(process.cwd(), "test-results");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, SYSTEM_SCAN_REPORT_FILE);

  let existing: RouteScanResult[] = [];
  if (fs.existsSync(reportPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(reportPath, "utf8")) as RouteScanResult[];
    } catch {
      existing = [];
    }
  }

  const withoutCurrentProject = existing.filter((entry) => entry.project !== projectName);
  const merged = [...withoutCurrentProject, ...entries].sort((left, right) =>
    `${left.project}:${left.route}`.localeCompare(`${right.project}:${right.route}`),
  );

  fs.writeFileSync(reportPath, JSON.stringify(merged, null, 2));
}

test.describe("System diagnostic scanner", () => {
  test.describe.configure({ retries: 0 });
  test.setTimeout(1_500_000);

  test("routes and primary actions are healthy", async ({ page, context }, testInfo) => {
    const projectName = testInfo.project.name.toLowerCase();
    const runActionAudit = projectName !== "mobile";
    const filesystemRoutes = discoverFilesystemRoutes();

    const unauthRoutes = filesystemRoutes.filter((route) => AUTH_ROUTE_HINTS.has(route));
    const projectResults: RouteScanResult[] = [];

    for (const route of unauthRoutes) {
      projectResults.push(await scanRoute(route, page, testInfo, { auditActions: false }));
    }

    await ensureAuthenticated(page, context);
    const uiRoutes = await discoverUiRoutes(page);

    const mergedRoutes = [...new Set([...filesystemRoutes, ...uiRoutes])]
      .map((route) => normalizeRoutePath(route))
      .filter((route): route is string => Boolean(route))
      .sort();

    for (const route of mergedRoutes) {
      if (AUTH_ROUTE_HINTS.has(route)) {
        continue;
      }
      projectResults.push(await scanRoute(route, page, testInfo, { auditActions: runActionAudit }));
    }

    writeSystemScanReport(projectResults, projectName);

    const failingRoutes = projectResults.filter((entry) => entry.status === "fail");
    const summary = failingRoutes.map((entry) => {
      const deadActionSummary = entry.deadActions.map((action) => action.text).join(", ");
      return `${entry.route} | status=${entry.httpStatus ?? "none"} | 500=${entry.failedRequests.some((request) => request.status >= 500)} | banner=${entry.bannerDetected} | hydrationMismatch=${entry.hydrationMismatch} | pageErrors=${entry.pageErrors.length} | deadActions=[${deadActionSummary}]`;
    });

    expect(
      failingRoutes,
      `System scan found failures:\n${summary.join("\n") || "none"}`,
    ).toHaveLength(0);
  });
});
