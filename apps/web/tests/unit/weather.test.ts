import { describe, it, expect } from "vitest";
import { weatherCodeToDescription, weatherCodeToEmoji, DEFAULT_STATIONS } from "@/lib/weather/client";

describe("Weather client", () => {
  describe("weatherCodeToDescription", () => {
    it("maps code 0 to Clear sky", () => {
      expect(weatherCodeToDescription(0)).toBe("Clear sky");
    });

    it("maps code 3 to Overcast", () => {
      expect(weatherCodeToDescription(3)).toBe("Overcast");
    });

    it("maps code 95 to Thunderstorm", () => {
      expect(weatherCodeToDescription(95)).toBe("Thunderstorm");
    });

    it("returns Unknown for invalid code", () => {
      expect(weatherCodeToDescription(999)).toBe("Unknown");
    });
  });

  describe("weatherCodeToEmoji", () => {
    it("returns sun for clear", () => {
      expect(weatherCodeToEmoji(0)).toBe("☀️");
    });

    it("returns cloud for partly cloudy", () => {
      expect(weatherCodeToEmoji(2)).toBe("⛅");
    });

    it("returns rain for heavy rain", () => {
      expect(weatherCodeToEmoji(65)).toBe("🌧️");
    });

    it("returns snow for snow", () => {
      expect(weatherCodeToEmoji(75)).toBe("❄️");
    });

    it("returns thunderstorm for code 99", () => {
      expect(weatherCodeToEmoji(99)).toBe("⛈️");
    });
  });

  describe("DEFAULT_STATIONS", () => {
    it("has default station", () => {
      expect(DEFAULT_STATIONS["default"]).toBeDefined();
      expect(DEFAULT_STATIONS["default"]!.name).toBe("Thessaloniki Airport");
    });

    it("has valid coordinates", () => {
      for (const [, station] of Object.entries(DEFAULT_STATIONS)) {
        expect(station.lat).toBeGreaterThan(30);
        expect(station.lat).toBeLessThan(50);
        expect(station.lon).toBeGreaterThan(20);
        expect(station.lon).toBeLessThan(30);
      }
    });

    it("has at least 3 stations", () => {
      expect(Object.keys(DEFAULT_STATIONS).length).toBeGreaterThanOrEqual(3);
    });
  });
});
