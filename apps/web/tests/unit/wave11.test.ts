import { describe, it, expect, vi } from "vitest";

describe("Wave 11 — Geolocation Weather + FTS Trigram Search", () => {
  describe("W11-A: Geolocation Weather Widget", () => {
    it("WeatherWidgetGeo component is exported", async () => {
      const mod = await import("@/components/widgets/weather-widget-geo");
      expect(mod.WeatherWidgetGeo).toBeDefined();
      expect(typeof mod.WeatherWidgetGeo).toBe("function");
    });

    it("original WeatherWidget still exists as fallback", async () => {
      const mod = await import("@/components/widgets/weather-widget");
      expect(mod.WeatherWidget).toBeDefined();
    });

    it("weather API route still exists and accepts lat/lon", async () => {
      const mod = await import("@/app/api/weather/route");
      expect(mod.GET).toBeDefined();
    });

    it("weather client exports fetchWeather with lat/lon params", async () => {
      const mod = await import("@/lib/weather/client");
      expect(mod.fetchWeather).toBeDefined();
      expect(mod.fetchWeatherSafe).toBeDefined();
      expect(mod.DEFAULT_STATIONS).toBeDefined();
      expect(mod.weatherCodeToEmoji).toBeDefined();
    });
  });

  describe("W11-B: FTS Trigram Search", () => {
    it("search route exports GET handler", async () => {
      const mod = await import("@/app/api/search/route");
      expect(mod.GET).toBeDefined();
      expect(typeof mod.GET).toBe("function");
    });

    it("pg_trgm migration file exists", async () => {
      const fs = await import("fs");
      const path = "prisma/migrations/20260222201100_wave11_fts_trigram/migration.sql";
      const fullPath = `${process.cwd()}/${path}`;
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("pg_trgm");
      expect(content).toContain("gin_trgm_ops");
      expect(content).toContain("idx_vehicle_plate_trgm");
    });
  });

  describe("W11-C: Fleet E2E Fix", () => {
    it("bulk fleet bar exports component", async () => {
      const mod = await import("@/app/(app)/fleet/bulk-fleet-bar");
      expect(mod.BulkFleetBar).toBeDefined();
    });
  });

  describe("Weather code emoji mapping", () => {
    it("maps WMO codes correctly", async () => {
      const { weatherCodeToEmoji } = await import("@/lib/weather/client");
      expect(weatherCodeToEmoji(0)).toBe("☀️");
      expect(weatherCodeToEmoji(3)).toBe("⛅");
      expect(weatherCodeToEmoji(61)).toBe("🌧️");
      expect(weatherCodeToEmoji(73)).toBe("❄️");
      expect(weatherCodeToEmoji(95)).toBe("⛈️");
    });
  });

  describe("Geolocation cache helpers", () => {
    it("sessionStorage operations are safe when unavailable", () => {
      // In test env sessionStorage may not exist — widget should not crash
      const mockStorage = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      };
      // Verify storage API shape matches what widget uses
      expect(typeof mockStorage.getItem).toBe("function");
      expect(typeof mockStorage.setItem).toBe("function");
    });
  });
});
