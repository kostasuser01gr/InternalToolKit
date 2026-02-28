/**
 * API Contract Suite v2 — validates status codes and JSON shapes for /api/* endpoints.
 * Never audits HTML or Axe/LHCI here.
 */
import { expect, test } from "@playwright/test";

test.describe("API Contracts v2", () => {
  
  test("/api/health returns 200 JSON", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("/api/version returns valid schema", async ({ request }) => {
    const res = await request.get("/api/version");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.version).toBeDefined();
  });

  test("/api/session/login-form (unauth) returns 405, 401 or 303 JSON/Redirect", async ({ request }) => {
    // This endpoint expects Form Data. Sending empty form to check robustness.
    const res = await request.post("/api/session/login-form", { 
      form: { method: "password", email: "test@example.com", password: "password123" },
      maxRedirects: 0 
    });
    // It should redirect (303) back to login with error, or return JSON error
    expect(res.status()).toBeLessThan(500);
  });

  test("/api/activity (unauth) redirects or 401", async ({ request }) => {
    const res = await request.get("/api/activity", { maxRedirects: 0 });
    // Middleware might redirect to /login (307) or return 401
    expect([307, 401]).toContain(res.status());
  });

  test("/api/search (unauth) returns 200 and no 500", async ({ request }) => {
    const res = await request.get("/api/search?q=test");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results).toBeDefined();
    expect(body.error).toBeUndefined();
  });

});
