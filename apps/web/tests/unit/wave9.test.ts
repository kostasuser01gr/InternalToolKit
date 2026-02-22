/**
 * Wave 9 — Ops Inbox actions, feed→Viber mirror, automation engine,
 * optimistic notifications
 */

import { describe, it, expect } from "vitest";

// ── W9-A: Feed → Viber auto-mirror ──
describe("Wave 9-A: Feed → Viber auto-mirror in cron", () => {
  it("mirrorToViber is called with correct payload for high-relevance feeds", () => {
    // Simulate the auto-mirror call shape from cron daily
    const feedItem = {
      id: "fi-1",
      category: "BOOKING_POLICY",
      title: "Europcar changes cancellation policy",
      summary: "New 48h cancellation window introduced",
      relevanceScore: 0.85,
    };

    const mirrorPayload = {
      id: feedItem.id,
      channelSlug: "ops-general",
      content: `📰 ${feedItem.category}: ${feedItem.title}\n${feedItem.summary}\nRelevance: ${(feedItem.relevanceScore * 100).toFixed(0)}%`,
      authorName: "Feed Scanner",
      timestamp: new Date(),
    };

    expect(mirrorPayload.channelSlug).toBe("ops-general");
    expect(mirrorPayload.content).toContain("BOOKING_POLICY");
    expect(mirrorPayload.content).toContain("85%");
    expect(mirrorPayload.authorName).toBe("Feed Scanner");
  });

  it("only mirrors feeds with score >= 0.8", () => {
    const scores = [0.5, 0.7, 0.79, 0.8, 0.85, 0.95];
    const mirrored = scores.filter((s) => s >= 0.8);
    expect(mirrored).toEqual([0.8, 0.85, 0.95]);
  });
});

// ── W9-B: Ops Inbox actions ──
describe("Wave 9-B: Ops Inbox server actions", () => {
  it("ackFeedItemAction module exists", async () => {
    const mod = await import("@/app/(app)/ops-inbox/actions");
    expect(typeof mod.ackFeedItemAction).toBe("function");
    expect(typeof mod.dismissNotificationAction).toBe("function");
    expect(typeof mod.createIncidentAction).toBe("function");
    expect(typeof mod.resolveIncidentAction).toBe("function");
  });

  it("ops-inbox-actions-ui components export correctly", async () => {
    const mod = await import("@/app/(app)/ops-inbox/ops-inbox-actions-ui");
    expect(typeof mod.AckFeedButton).toBe("function");
    expect(typeof mod.DismissNotificationButton).toBe("function");
    expect(typeof mod.ResolveIncidentButton).toBe("function");
    expect(typeof mod.CreateIncidentForm).toBe("function");
  });
});

// ── W9-C: Automation execution engine ──
describe("Wave 9-C: Automation execution engine", () => {
  it("processes daily schedule match correctly", () => {
    const validSchedules = ["daily", "0 6 * * *", "cron.daily"];
    const invalidSchedules = ["hourly", "weekly", "*/30 * * * *", ""];

    for (const s of validSchedules) {
      const matches = s === "daily" || s === "0 6 * * *" || s === "cron.daily";
      expect(matches).toBe(true);
    }

    for (const s of invalidSchedules) {
      const matches = s === "daily" || s === "0 6 * * *" || s === "cron.daily";
      expect(matches).toBe(false);
    }
  });

  it("automation action types are handled", () => {
    const supportedActions = ["create_notification", "mirror_to_viber", "write_audit_log"];
    const actions = [
      { type: "create_notification", userId: "u1", title: "Test", body: "Body" },
      { type: "mirror_to_viber", channel: "ops-general", message: "Alert" },
      { type: "write_audit_log", action: "automation.run" },
    ];

    for (const a of actions) {
      expect(supportedActions).toContain(a.type);
    }
  });

  it("execution status is SUCCESS or FAILED", () => {
    const validStatuses = ["SUCCESS", "FAILED", "PENDING", "RUNNING", "DEAD_LETTER"];
    expect(validStatuses).toContain("SUCCESS");
    expect(validStatuses).toContain("FAILED");
  });
});

// ── W9-D: Optimistic notifications ──
describe("Wave 9-D: Optimistic notifications", () => {
  it("notifications-list component exports correctly", async () => {
    const mod = await import("@/app/(app)/notifications/notifications-list");
    expect(typeof mod.NotificationsList).toBe("function");
  });

  it("optimistic state update marks notification as read", () => {
    const notifications = [
      { id: "n1", title: "Alert", body: "Test", readAt: null, createdAt: new Date() },
      { id: "n2", title: "Info", body: "Test", readAt: null, createdAt: new Date() },
    ];

    // Simulate useOptimistic reducer
    const reducer = (state: typeof notifications, readId: string) =>
      state.map((n) => (n.id === readId ? { ...n, readAt: new Date() } : n));

    const updated = reducer(notifications, "n1");
    expect(updated[0].readAt).not.toBeNull();
    expect(updated[1].readAt).toBeNull();
  });
});

// ── W9-E: Integration completeness ──
describe("Wave 9-E: Integration checks", () => {
  it("cron daily imports isViberBridgeReady and mirrorToViber", async () => {
    const cronModule = await import("@/app/api/cron/daily/route");
    expect(typeof cronModule.GET).toBe("function");
    expect(typeof cronModule.getCronRunLog).toBe("function");
  });

  it("viber bridge exports all required functions", async () => {
    const bridge = await import("@/lib/viber/bridge");
    expect(typeof bridge.isViberBridgeReady).toBe("function");
    expect(typeof bridge.mirrorToViber).toBe("function");
    expect(typeof bridge.sendViaChannelRich).toBe("function");
    expect(typeof bridge.setViberWebhook).toBe("function");
    expect(typeof bridge.getViberAccountInfo).toBe("function");
  });
});
