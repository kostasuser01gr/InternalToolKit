import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/lib/security";

describe("isSameOriginRequest", () => {
  it("allows safe methods by default", () => {
    const request = new Request("https://app.example.com/home", {
      method: "GET",
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("allows same-origin post requests", () => {
    const request = new Request("https://app.example.com/api/session/login", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        host: "app.example.com",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("blocks cross-origin post requests", () => {
    const request = new Request("https://app.example.com/api/session/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});

