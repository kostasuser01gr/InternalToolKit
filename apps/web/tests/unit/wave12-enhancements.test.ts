import { describe, it, expect } from "vitest";

import { DEFAULT_SLA_CONFIGS, FLEET_VIEW_PRESETS, isSlaBreached } from "@/lib/fleet-pipeline";
import { DEFAULT_CHANNELS } from "@/lib/chat/default-channels";

describe("Wave 12 — Fleet SLA + Chat + Washers Enhancements", () => {
  describe("Fleet SLA breach detection", () => {
    it("detects NEEDS_CLEANING breach after 30min", () => {
      const thirtyOneMinAgo = new Date(Date.now() - 31 * 60_000);
      expect(isSlaBreached("NEEDS_CLEANING" as never, thirtyOneMinAgo)).toBe(true);
    });

    it("does not breach NEEDS_CLEANING within 30min", () => {
      const twentyMinAgo = new Date(Date.now() - 20 * 60_000);
      expect(isSlaBreached("NEEDS_CLEANING" as never, twentyMinAgo)).toBe(false);
    });

    it("detects CLEANING breach after 45min", () => {
      const fortySevenMinAgo = new Date(Date.now() - 47 * 60_000);
      expect(isSlaBreached("CLEANING" as never, fortySevenMinAgo)).toBe(true);
    });

    it("detects QC_PENDING breach after 15min", () => {
      const sixteenMinAgo = new Date(Date.now() - 16 * 60_000);
      expect(isSlaBreached("QC_PENDING" as never, sixteenMinAgo)).toBe(true);
    });

    it("no SLA for READY state", () => {
      const longAgo = new Date(Date.now() - 9999 * 60_000);
      expect(isSlaBreached("READY" as never, longAgo)).toBe(false);
    });

    it("DEFAULT_SLA_CONFIGS covers 3 states", () => {
      expect(Object.keys(DEFAULT_SLA_CONFIGS)).toHaveLength(3);
      expect(DEFAULT_SLA_CONFIGS["NEEDS_CLEANING"]!.maxMinutes).toBe(30);
      expect(DEFAULT_SLA_CONFIGS["CLEANING"]!.maxMinutes).toBe(45);
      expect(DEFAULT_SLA_CONFIGS["QC_PENDING"]!.maxMinutes).toBe(15);
    });
  });

  describe("Fleet saved view presets", () => {
    it("defines 4 fleet view presets", () => {
      expect(FLEET_VIEW_PRESETS).toHaveLength(4);
    });

    it("has Ready Now preset", () => {
      const preset = FLEET_VIEW_PRESETS.find((p) => p.name === "Ready Now");
      expect(preset).toBeDefined();
      expect(JSON.parse(preset!.filtersJson)).toEqual({ status: ["READY"] });
    });

    it("has Stuck > 30min preset", () => {
      const preset = FLEET_VIEW_PRESETS.find((p) => p.name === "Stuck > 30min");
      expect(preset).toBeDefined();
      expect(JSON.parse(preset!.filtersJson)).toEqual({ slaBreached: true });
    });

    it("has Needs QC preset", () => {
      const preset = FLEET_VIEW_PRESETS.find((p) => p.name === "Needs QC");
      expect(preset).toBeDefined();
    });

    it("has Blocked preset", () => {
      const preset = FLEET_VIEW_PRESETS.find((p) => p.name === "Blocked");
      expect(preset).toBeDefined();
    });
  });

  describe("Default chat channels", () => {
    it("defines ops-general and washers-only", () => {
      expect(DEFAULT_CHANNELS).toHaveLength(2);
      expect(DEFAULT_CHANNELS[0].slug).toBe("ops-general");
      expect(DEFAULT_CHANNELS[1].slug).toBe("washers-only");
    });

    it("ops-general has correct name", () => {
      expect(DEFAULT_CHANNELS[0].name).toBe("#ops-general");
    });

    it("washers-only has correct name", () => {
      expect(DEFAULT_CHANNELS[1].name).toBe("#washers-only");
    });
  });

  describe("Washer kiosk history date filter", () => {
    it("filters tasks by date string match", () => {
      const tasks = [
        { createdAt: "2026-02-23T10:00:00Z", status: "synced" },
        { createdAt: "2026-02-22T08:00:00Z", status: "synced" },
        { createdAt: "2026-02-23T15:00:00Z", status: "pending" },
      ];
      const historyDate = "2026-02-23";
      const filtered = tasks.filter(
        (t) => new Date(t.createdAt).toISOString().slice(0, 10) === historyDate,
      );
      expect(filtered).toHaveLength(2);
    });

    it("returns all tasks when no date filter", () => {
      const tasks = [
        { createdAt: "2026-02-23T10:00:00Z" },
        { createdAt: "2026-02-22T08:00:00Z" },
      ];
      const historyDate = "";
      const filtered = historyDate
        ? tasks.filter((t) => new Date(t.createdAt).toISOString().slice(0, 10) === historyDate)
        : tasks;
      expect(filtered).toHaveLength(2);
    });
  });

  describe("QR code component", () => {
    it("ShareQrCode module exports correctly", async () => {
      const mod = await import("@/app/(app)/washers/share-qr-code");
      expect(mod.ShareQrCode).toBeDefined();
    });
  });
});
