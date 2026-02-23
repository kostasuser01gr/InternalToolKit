import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// API contract tests — validate status codes and JSON shape, NOT a11y / HTML.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Redirect / auth-gate smoke tests
// ---------------------------------------------------------------------------

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
