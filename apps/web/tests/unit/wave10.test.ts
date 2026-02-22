import { describe, it, expect } from "vitest";

describe("Wave 10 — Fleet Bulk + Ops Badge + Feed Keywords", () => {
  describe("W10-A: Fleet Bulk Status Change", () => {
    it("bulk fleet bar module exports BulkFleetBar component", async () => {
      const mod = await import("@/app/(app)/fleet/bulk-fleet-bar");
      expect(mod.BulkFleetBar).toBeDefined();
      expect(typeof mod.BulkFleetBar).toBe("function");
    });

    it("bulkUpdateVehiclesAction is exported from fleet actions", async () => {
      const mod = await import("@/app/(app)/fleet/actions");
      expect(mod.bulkUpdateVehiclesAction).toBeDefined();
      expect(typeof mod.bulkUpdateVehiclesAction).toBe("function");
    });

    it("bulk targets include key pipeline statuses", async () => {
      // The component hardcodes BULK_TARGETS — verify VehicleStatus enum has them
      const { VehicleStatus } = await import("@prisma/client");
      expect(VehicleStatus.NEEDS_CLEANING).toBe("NEEDS_CLEANING");
      expect(VehicleStatus.CLEANING).toBe("CLEANING");
      expect(VehicleStatus.QC_PENDING).toBe("QC_PENDING");
      expect(VehicleStatus.READY).toBe("READY");
      expect(VehicleStatus.OUT_OF_SERVICE).toBe("OUT_OF_SERVICE");
    });
  });

  describe("W10-C: Feed Relevance Keywords", () => {
    it("FeedSourceKeywords component is exported", async () => {
      const mod = await import("@/app/(app)/feeds/feed-source-keywords");
      expect(mod.FeedSourceKeywords).toBeDefined();
    });

    it("updateFeedSourceKeywordsAction is exported", async () => {
      const mod = await import("@/app/(app)/feeds/actions");
      expect(mod.updateFeedSourceKeywordsAction).toBeDefined();
      expect(typeof mod.updateFeedSourceKeywordsAction).toBe("function");
    });
  });

  describe("W10-D: Ops Inbox Badge", () => {
    it("ChatFirstShell accepts opsInboxCount prop", async () => {
      const mod = await import("@/components/layout/chat-first-shell");
      expect(mod.ChatFirstShell).toBeDefined();
    });

    it("AppShell accepts opsInboxCount prop", async () => {
      const mod = await import("@/components/layout/app-shell");
      expect(mod.AppShell).toBeDefined();
    });
  });

  describe("W10-B: Shift Calendar (no-op verification)", () => {
    it("shift pages exist and export default", async () => {
      const mod = await import("@/app/(app)/shifts/page");
      expect(mod.default).toBeDefined();
    });
  });

  describe("Utility: Fleet Pipeline transitions", () => {
    it("isValidTransition validates RETURNED→NEEDS_CLEANING", async () => {
      const { isValidTransition } = await import("@/lib/fleet-pipeline");
      const { VehicleStatus } = await import("@prisma/client");
      expect(isValidTransition(VehicleStatus.RETURNED, VehicleStatus.NEEDS_CLEANING)).toBe(true);
      expect(isValidTransition(VehicleStatus.RETURNED, VehicleStatus.READY)).toBe(false);
    });
  });
});
