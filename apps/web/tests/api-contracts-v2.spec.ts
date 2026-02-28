import { test, expect } from "@playwright/test";

test.describe("API Contracts V2", () => {
  test("/api/health returns 200 JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    
    // Must be 200 OK
    expect(response.status()).toBe(200);

    // Never HTML, never redirect
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");
    expect(contentType).not.toContain("text/html");

    // Must be valid JSON
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("timestamp");
  });

  // Additional critical endpoints can be added here
});
