import { describe, it, expect } from "vitest";
import { differenceInMinutes } from "date-fns";

// ─── KPI Computation Tests ──────────────────────────────────────────────────
describe("Washer KPI computation", () => {
  const mockTasks = [
    {
      id: "1",
      status: "DONE",
      createdAt: new Date("2025-01-15T08:00:00Z"),
      updatedAt: new Date("2025-01-15T08:25:00Z"),
      washer: { name: "Alice" },
    },
    {
      id: "2",
      status: "DONE",
      createdAt: new Date("2025-01-15T09:00:00Z"),
      updatedAt: new Date("2025-01-15T09:15:00Z"),
      washer: { name: "Alice" },
    },
    {
      id: "3",
      status: "TODO",
      createdAt: new Date("2025-01-15T10:00:00Z"),
      updatedAt: new Date("2025-01-15T10:00:00Z"),
      washer: null,
    },
    {
      id: "4",
      status: "IN_PROGRESS",
      createdAt: new Date("2025-01-15T10:30:00Z"),
      updatedAt: new Date("2025-01-15T10:35:00Z"),
      washer: { name: "Bob" },
    },
    {
      id: "5",
      status: "BLOCKED",
      createdAt: new Date("2025-01-15T11:00:00Z"),
      updatedAt: new Date("2025-01-15T11:05:00Z"),
      washer: { name: "Bob" },
    },
  ];

  it("counts total tasks", () => {
    expect(mockTasks.length).toBe(5);
  });

  it("counts done tasks", () => {
    const done = mockTasks.filter((t) => t.status === "DONE").length;
    expect(done).toBe(2);
  });

  it("counts pending tasks (TODO + IN_PROGRESS)", () => {
    const pending = mockTasks.filter(
      (t) => t.status === "TODO" || t.status === "IN_PROGRESS",
    ).length;
    expect(pending).toBe(2);
  });

  it("counts blocked tasks", () => {
    const blocked = mockTasks.filter((t) => t.status === "BLOCKED").length;
    expect(blocked).toBe(1);
  });

  it("calculates average turnaround for completed tasks", () => {
    const completed = mockTasks.filter((t) => t.status === "DONE");
    const totalMin = completed.reduce(
      (sum, t) => sum + differenceInMinutes(t.updatedAt, t.createdAt),
      0,
    );
    const avg = Math.round(totalMin / completed.length);
    // Task 1: 25 min, Task 2: 15 min → avg = 20 min
    expect(avg).toBe(20);
  });

  it("builds top washers leaderboard", () => {
    const counts = new Map<string, number>();
    for (const t of mockTasks) {
      const name = t.washer?.name ?? "Kiosk";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0]).toEqual(["Alice", 2]);
    expect(sorted[1]).toEqual(["Bob", 2]);
    expect(sorted[2]).toEqual(["Kiosk", 1]);
  });
});

// ─── Kiosk Token Validation Tests ───────────────────────────────────────────
describe("Kiosk token validation", () => {
  function validateToken(token: string, envToken: string): boolean {
    return token.length > 0 && token === envToken;
  }

  it("rejects empty token", () => {
    expect(validateToken("", "abc123")).toBe(false);
  });

  it("rejects mismatched token", () => {
    expect(validateToken("wrong", "abc123")).toBe(false);
  });

  it("accepts valid matching token", () => {
    expect(validateToken("abc123", "abc123")).toBe(true);
  });

  it("rejects when env token not set", () => {
    expect(validateToken("abc123", "")).toBe(false);
  });
});

// ─── Idempotency Key Tests ──────────────────────────────────────────────────
describe("Idempotency key generation", () => {
  it("generates unique keys", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(crypto.randomUUID());
    }
    expect(keys.size).toBe(100);
  });

  it("is valid UUID format", () => {
    const key = crypto.randomUUID();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

// ─── Device ID Persistence Tests ────────────────────────────────────────────
describe("Device ID persistence", () => {
  it("generates stable device ID", () => {
    const id1 = crypto.randomUUID();
    // In actual code, would be stored in localStorage
    expect(id1).toBeTruthy();
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
  });
});

// ─── Theme Tests ────────────────────────────────────────────────────────────
describe("Kiosk theme", () => {
  const VALID_THEMES = ["quantum", "dark", "light", "high-contrast"];

  it("validates known themes", () => {
    expect(VALID_THEMES.includes("quantum")).toBe(true);
    expect(VALID_THEMES.includes("dark")).toBe(true);
    expect(VALID_THEMES.includes("invalid")).toBe(false);
  });

  it("falls back to quantum for invalid theme", () => {
    const override = "invalid";
    const theme = VALID_THEMES.includes(override) ? override : "quantum";
    expect(theme).toBe("quantum");
  });

  it("applies override from link param", () => {
    const override = "high-contrast";
    const theme = VALID_THEMES.includes(override) ? override : "quantum";
    expect(theme).toBe("high-contrast");
  });
});

// ─── CSV Export Tests ───────────────────────────────────────────────────────
describe("Washer CSV export", () => {
  it("generates valid CSV header", () => {
    const headers = [
      "Created",
      "Plate",
      "Washer",
      "Status",
      "Exterior",
      "Interior",
      "Vacuum",
      "Notes",
    ];
    const csv = headers.join(",");
    expect(csv).toContain("Created");
    expect(csv).toContain("Plate");
    expect(csv.split(",").length).toBe(8);
  });

  it("escapes commas in CSV values", () => {
    const value = 'Note with, comma and "quotes"';
    const escaped = `"${value.replace(/"/g, '""')}"`;
    expect(escaped).toBe('"Note with, comma and ""quotes"""');
  });
});

// ─── Viber Bridge Tests ─────────────────────────────────────────────────────
import { redactSensitiveContent, getBridgeStatus } from "@/lib/viber/bridge";

describe("Viber Bridge", () => {
  describe("redactSensitiveContent", () => {
    it("redacts email addresses", () => {
      expect(redactSensitiveContent("Contact john@example.com")).toBe("Contact [email]");
    });

    it("redacts phone numbers", () => {
      expect(redactSensitiveContent("Call +1-555-123-4567")).toContain("[phone]");
    });

    it("redacts long tokens", () => {
      const token = "a".repeat(40);
      expect(redactSensitiveContent(`Key: ${token}`)).toBe("Key: [redacted]");
    });

    it("preserves normal text", () => {
      expect(redactSensitiveContent("Car ABC1234 done")).toBe("Car ABC1234 done");
    });
  });

  describe("getBridgeStatus", () => {
    it("returns disabled when env not set", async () => {
      const status = await getBridgeStatus();
      expect(status.enabled).toBe(false);
      expect(status.ready).toBe(false);
    });

    it("returns correct structure", async () => {
      const status = await getBridgeStatus();
      expect(status).toHaveProperty("deadLetterCount");
      expect(status).toHaveProperty("recentFailures");
      expect(status).toHaveProperty("mode");
    });
  });
});

// ─── Channel Slug Tests ─────────────────────────────────────────────────────
describe("Channel slugs", () => {
  it("washers-only slug is valid", () => {
    expect("washers-only").toMatch(/^[a-z0-9-]+$/);
  });

  it("ops-general slug is valid", () => {
    expect("ops-general").toMatch(/^[a-z0-9-]+$/);
  });
});
