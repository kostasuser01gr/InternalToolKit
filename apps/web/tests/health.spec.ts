import { expect, test } from "@playwright/test";

test("GET /api/health returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.db).toBeTruthy();
});

test("GET /api/health/db returns backend status", async ({ request }) => {
  const response = await request.get("/api/health/db");
  const body = await response.json();
  expect(body.ok).toBeDefined();
  expect(body.backends).toBeDefined();
});

test("/login does NOT redirect to /login (no loop)", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  expect(page.url()).toMatch(/\/login/);
  // Should not have been redirected away from login
  expect(page.url()).not.toMatch(/callbackUrl/);
});

test("unauth access to /overview redirects to /login once", async ({
  page,
}) => {
  const response = await page.goto("/overview", { waitUntil: "commit" });
  // Should redirect to login with callbackUrl, not loop
  expect(page.url()).toMatch(/\/login/);
  expect(response?.status()).toBeLessThan(400);
});
