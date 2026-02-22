import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Feeds VirtualTable ───────────────────────────────────────────────────────

describe("Feeds VirtualTable integration", () => {
  it("FeedItemsTable component is exported", async () => {
    const mod = await import("@/app/(app)/feeds/feed-items-table");
    expect(mod.FeedItemsTable).toBeDefined();
  });

  it("Feeds page imports FeedItemsTable", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(app)/feeds/page.tsx"),
      "utf-8",
    );
    expect(src).toContain("FeedItemsTable");
  });

  it("Feeds page no longer uses Badge import", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(app)/feeds/page.tsx"),
      "utf-8",
    );
    expect(src).not.toMatch(/import[\s\S]*\bBadge\b[\s\S]*from/);
  });
});

// ─── Daily Register VirtualTable ──────────────────────────────────────────────

describe("Daily Register VirtualTable integration", () => {
  it("DailyRegisterClient uses VirtualTable", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(app)/washers/daily-register-client.tsx"),
      "utf-8",
    );
    expect(src).toContain("VirtualTable");
  });

  it("DailyRegisterClient supports checkbox selection", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(app)/washers/daily-register-client.tsx"),
      "utf-8",
    );
    expect(src).toContain("checkbox");
  });
});

// ─── Role Shortcuts Admin ─────────────────────────────────────────────────────

describe("Role Shortcuts admin", () => {
  it("RoleShortcutsEditor component is exported", async () => {
    const mod = await import("@/components/settings/role-shortcuts-editor");
    expect(mod.RoleShortcutsEditor).toBeDefined();
  });

  it("role-shortcuts-actions exports save and get functions", async () => {
    const mod = await import("@/app/(app)/settings/role-shortcuts-actions");
    expect(mod.saveRoleShortcutsAction).toBeDefined();
    expect(mod.getRoleShortcuts).toBeDefined();
  });

  it("uses correct WorkspaceRole enum values", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/settings/role-shortcuts-editor.tsx"),
      "utf-8",
    );
    expect(src).toContain("ADMIN");
    expect(src).toContain("EDITOR");
    expect(src).toContain("EMPLOYEE");
    expect(src).toContain("WASHER");
    expect(src).toContain("VIEWER");
    expect(src).not.toContain('"COORDINATOR"');
    expect(src).not.toContain('"STAFF"');
  });

  it("settings page imports RoleShortcutsEditor", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(app)/settings/page.tsx"),
      "utf-8",
    );
    expect(src).toContain("RoleShortcutsEditor");
  });
});

// ─── QuickBar role shortcuts wiring ───────────────────────────────────────────

describe("QuickBar role shortcuts prop", () => {
  it("QuickBar accepts roleShortcuts prop", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/layout/quick-bar.tsx"),
      "utf-8",
    );
    expect(src).toContain("roleShortcuts");
  });

  it("ChatFirstShell passes roleShortcuts to QuickBar", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/layout/chat-first-shell.tsx"),
      "utf-8",
    );
    expect(src).toContain("roleShortcuts={roleShortcuts}");
  });

  it("AppShell passes roleShortcuts to ChatFirstShell", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/layout/app-shell.tsx"),
      "utf-8",
    );
    expect(src).toContain("roleShortcuts={roleShortcuts}");
  });

  it("layout loads roleShortcuts and passes to AppShell", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(app)/layout.tsx"),
      "utf-8",
    );
    expect(src).toContain("getRoleShortcuts");
    expect(src).toContain("roleShortcuts=");
  });

  it("QuickBar uses EMPLOYEE as default role (not STAFF)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/layout/quick-bar.tsx"),
      "utf-8",
    );
    expect(src).toContain("EMPLOYEE");
    expect(src).not.toContain('"STAFF"');
  });
});

// ─── Feed auto-pin ────────────────────────────────────────────────────────────

describe("Feed auto-pin high-relevance items", () => {
  it("cron daily route auto-pins items with relevanceScore >= 0.8", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/cron/daily/route.ts"),
      "utf-8",
    );
    expect(src).toContain("relevanceScore >= 0.8");
    expect(src).toContain("isPinned: true");
  });

  it("cron creates FEED_HIGH_RELEVANCE notification for admins", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/cron/daily/route.ts"),
      "utf-8",
    );
    expect(src).toContain("FEED_HIGH_RELEVANCE");
    expect(src).toContain('"ADMIN"');
    expect(src).toContain('"EDITOR"');
    expect(src).not.toContain('"COORDINATOR"');
  });

  it("auto-pin notification failure does not break feed scan", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/cron/daily/route.ts"),
      "utf-8",
    );
    // The notification block is wrapped in try-catch
    const idx = src.indexOf("FEED_HIGH_RELEVANCE");
    const context = src.slice(Math.max(0, idx - 500), idx + 500);
    expect(context).toContain("try");
    expect(context).toContain("catch");
  });
});
