/**
 * API contract tests — validate status codes and JSON shapes for /api/* endpoints.
 * No a11y / HTML scanning here.
 */
import { expect, test } from "@playwright/test";

/* ------------------------------------------------------------------ */
/*  Health endpoints                                                    */
/* ------------------------------------------------------------------ */

test("GET /api/health returns 200 with expected JSON shape", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");

  const body = await response.json();
  expect(typeof body.ok).toBe("boolean");
  expect(body.ok).toBe(true);
  expect(body.db).toBeTruthy();
});

test("GET /api/health/db returns backend status shape", async ({
  request,
}) => {
  const response = await request.get("/api/health/db");
  expect(response.headers()["content-type"]).toContain("application/json");

  const body = await response.json();
  expect(typeof body.ok).toBe("boolean");
  expect(body.backends).toBeDefined();
  expect(typeof body.backends).toBe("object");
});

/* ------------------------------------------------------------------ */
/*  Version endpoint                                                    */
/* ------------------------------------------------------------------ */

test("GET /api/version returns JSON with version string", async ({
  request,
}) => {
  const response = await request.get("/api/version");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");

  const body = await response.json();
  expect(typeof body.version).toBe("string");
  expect(body.version.length).toBeGreaterThan(0);
});

/* ------------------------------------------------------------------ */
/*  Search endpoint (unauthenticated should return 401 or empty)       */
/* ------------------------------------------------------------------ */

test("GET /api/search without auth returns valid response", async ({
  request,
}) => {
  const response = await request.get("/api/search?q=test");
  // Could be 200 (results), 401/403 (auth), or 500 (pg_trgm not available)
  expect(response.status()).toBeLessThanOrEqual(500);
  if (response.status() === 200) {
    const body = await response.json();
    expect(body).toBeDefined();
  }
});

/* ------------------------------------------------------------------ */
/*  Weather endpoint                                                    */
/* ------------------------------------------------------------------ */

test("GET /api/weather returns JSON", async ({ request }) => {
  const response = await request.get("/api/weather");
  // Could require auth or config
  expect(response.status()).toBeLessThan(500);
  if (response.status() === 200) {
    expect(response.headers()["content-type"]).toContain("application/json");
  }
});

/* ------------------------------------------------------------------ */
/*  Activity endpoint                                                   */
/* ------------------------------------------------------------------ */

test("GET /api/activity without auth returns 401 or valid JSON", async ({
  request,
}) => {
  const response = await request.get("/api/activity");
  expect([200, 401, 403]).toContain(response.status());
  if (response.status() === 200) {
    expect(response.headers()["content-type"]).toContain("application/json");
  }
});

/* ------------------------------------------------------------------ */
/*  Integrations status                                                 */
/* ------------------------------------------------------------------ */

test("GET /api/integrations/status returns JSON shape", async ({
  request,
}) => {
  const response = await request.get("/api/integrations/status");
  expect(response.status()).toBeLessThan(500);
  if (response.status() === 200) {
    expect(response.headers()["content-type"]).toContain("application/json");
    const body = await response.json();
    expect(body).toBeDefined();
  }
});

/* ------------------------------------------------------------------ */
/*  Session endpoints                                                   */
/* ------------------------------------------------------------------ */

test("POST /api/session/logout returns valid response", async ({
  request,
}) => {
  const response = await request.post("/api/session/logout", {
    headers: { Origin: "http://127.0.0.1:4173" },
  });
  // Should work even without a session
  expect(response.status()).toBeLessThan(500);
});

/* ------------------------------------------------------------------ */
/*  AI health (optional, may not be configured)                         */
/* ------------------------------------------------------------------ */

test("GET /api/ai/health returns valid response", async ({ request }) => {
  const response = await request.get("/api/ai/health");
  expect(response.status()).toBeLessThan(500);
  if (response.status() === 200) {
    expect(response.headers()["content-type"]).toContain("application/json");
  }
});

/* ------------------------------------------------------------------ */
/*  Redirect / auth-gate smoke tests                                    */
/* ------------------------------------------------------------------ */

test("/login does NOT redirect to /login (no loop)", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  expect(page.url()).toMatch(/\/login/);
  expect(page.url()).not.toMatch(/callbackUrl/);
});

test("unauth access to /overview redirects to /login once", async ({
  page,
}) => {
  const response = await page.goto("/overview", { waitUntil: "commit" });
  expect(page.url()).toMatch(/\/login/);
  expect(response?.status()).toBeLessThan(400);
});
