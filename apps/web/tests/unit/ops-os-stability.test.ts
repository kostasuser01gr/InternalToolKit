import { describe, it, expect } from "vitest";

describe("SchemaFallbackBanner — module", () => {
  it("exports SchemaFallbackBanner component", async () => {
    const mod = await import("@/components/layout/schema-fallback-banner");
    expect(typeof mod.SchemaFallbackBanner).toBe("function");
  });
});

describe("Error Boundary — module", () => {
  it("exports default AppError component", async () => {
    const mod = await import("@/app/(app)/error");
    expect(typeof mod.default).toBe("function");
  });
});

describe("Server Error — mapServerError", () => {
  it("exports mapServerError function", async () => {
    const mod = await import("@/lib/server-error");
    expect(typeof mod.mapServerError).toBe("function");
  });
});

describe("Weather Client — module exports", () => {
  it("exports fetchWeather and fetchWeatherSafe", async () => {
    const mod = await import("@/lib/weather/client");
    expect(typeof mod.fetchWeather).toBe("function");
    expect(typeof mod.fetchWeatherSafe).toBe("function");
  });

  it("exports weatherCodeToDescription", async () => {
    const { weatherCodeToDescription } = await import("@/lib/weather/client");
    expect(weatherCodeToDescription(0)).toBe("Clear sky");
    expect(weatherCodeToDescription(95)).toBe("Thunderstorm");
    expect(weatherCodeToDescription(9999)).toBe("Unknown");
  });

  it("exports weatherCodeToEmoji", async () => {
    const { weatherCodeToEmoji } = await import("@/lib/weather/client");
    expect(weatherCodeToEmoji(0)).toBe("☀️");
    expect(weatherCodeToEmoji(65)).toBe("🌧️");
  });

  it("exports DEFAULT_STATIONS with at least default", async () => {
    const { DEFAULT_STATIONS } = await import("@/lib/weather/client");
    expect(DEFAULT_STATIONS["default"]).toBeDefined();
    expect(DEFAULT_STATIONS["default"]!.lat).toBeGreaterThan(0);
  });
});

describe("Prisma Errors — schema detection", () => {
  it("detects P2021 as schema-not-ready", async () => {
    const { isSchemaNotReadyError, isPrismaKnownErrorCode } = await import("@/lib/prisma-errors");
    const err = Object.assign(new Error("table does not exist"), { code: "P2021" });
    expect(isSchemaNotReadyError(err)).toBe(true);
    expect(isPrismaKnownErrorCode(err, "P2021")).toBe(true);
  });

  it("does not treat connection errors as schema-not-ready", async () => {
    const { isSchemaNotReadyError } = await import("@/lib/prisma-errors");
    const err = new Error("ECONNREFUSED 127.0.0.1:5432");
    expect(isSchemaNotReadyError(err)).toBe(false);
  });
});
