import { expect, test } from "@playwright/test";

function looksLikeStackTrace(payload: string) {
  return /(?:at\s+[A-Za-z0-9_$.<>\[\]]+\s+\(|\n\s*at\s+)/.test(payload);
}

test.describe("API Contracts System", () => {
  test("/api/health returns JSON 200 and never redirects", async ({ request }) => {
    const response = await request.get("/api/health", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    expect(response.url()).toContain("/api/health");

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
    expect(contentType).not.toContain("text/html");

    const payload = await response.json();
    expect(typeof payload.ok).toBe("boolean");
    expect(["ok", "degraded"]).toContain(payload.status);
    expect(typeof payload.timestamp).toBe("string");
    expect(typeof payload.dependencies).toBe("object");
  });

  test("/api/health response contains correlation headers", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const requestId = response.headers()["x-request-id"];
    expect(requestId, "X-Request-Id must be present").toBeTruthy();
  });

  test("/api/session/login-form returns JSON error object for invalid payload", async ({ request }) => {
    const response = await request.post("/api/session/login", {
      data: {},
      headers: {
        "content-type": "application/json",
      },
    });

    expect([400, 401, 403, 500, 503]).toContain(response.status());
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    const bodyText = await response.text();
    expect(looksLikeStackTrace(bodyText)).toBeFalsy();

    const body = JSON.parse(bodyText);
    expect(body).toHaveProperty("ok");
    if (body.ok === false) {
      expect(body).toHaveProperty("message");
    }
  });

  test("/api/fleet/control-tower validates query without leaking stack traces", async ({ request }) => {
    const response = await request.get("/api/fleet/control-tower");
    expect(response.status()).toBe(400);

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    const bodyText = await response.text();
    expect(looksLikeStackTrace(bodyText)).toBeFalsy();

    const body = JSON.parse(bodyText);
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
    expect(typeof body.error.errorId).toBe("string");
  });
});
