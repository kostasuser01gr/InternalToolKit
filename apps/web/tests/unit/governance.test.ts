import { describe, expect, it } from "vitest";

import { hasWorkspacePermission } from "@/lib/rbac";
import {
  createEntityThreadSchema,
  mentionUserSchema,
  moderateMessageSchema,
} from "@/lib/validators/chat";

describe("RBAC analytics resource", () => {
  it("allows ADMIN to read analytics", () => {
    expect(hasWorkspacePermission("ADMIN", "analytics", "read")).toBe(true);
  });

  it("allows EDITOR to read analytics", () => {
    expect(hasWorkspacePermission("EDITOR", "analytics", "read")).toBe(true);
  });

  it("allows VIEWER to read analytics", () => {
    expect(hasWorkspacePermission("VIEWER", "analytics", "read")).toBe(true);
  });

  it("rejects WASHER from reading analytics", () => {
    expect(hasWorkspacePermission("WASHER", "analytics", "read")).toBe(false);
  });

  it("allows ADMIN to export analytics", () => {
    expect(hasWorkspacePermission("ADMIN", "analytics", "export")).toBe(true);
  });

  it("allows EDITOR to export analytics", () => {
    expect(hasWorkspacePermission("EDITOR", "analytics", "export")).toBe(true);
  });

  it("rejects EMPLOYEE from exporting analytics", () => {
    expect(hasWorkspacePermission("EMPLOYEE", "analytics", "export")).toBe(false);
  });

  it("rejects VIEWER from exporting analytics", () => {
    expect(hasWorkspacePermission("VIEWER", "analytics", "export")).toBe(false);
  });
});

describe("chat entity thread schema", () => {
  it("accepts valid entity thread payload", () => {
    const payload = {
      workspaceId: "ws-1",
      title: "Vehicle ABC Discussion",
      entityType: "vehicle",
      entityId: "v-1",
    };
    expect(createEntityThreadSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts all valid entity types", () => {
    for (const type of ["vehicle", "washer_task", "shift", "shift_request"]) {
      const payload = {
        workspaceId: "ws-1",
        title: "Discussion",
        entityType: type,
        entityId: "id-1",
      };
      expect(createEntityThreadSchema.safeParse(payload).success).toBe(true);
    }
  });

  it("rejects invalid entity type", () => {
    const payload = {
      workspaceId: "ws-1",
      title: "Discussion",
      entityType: "invalid_type",
      entityId: "id-1",
    };
    expect(createEntityThreadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects missing entityId", () => {
    const payload = {
      workspaceId: "ws-1",
      title: "Discussion",
      entityType: "vehicle",
    };
    expect(createEntityThreadSchema.safeParse(payload).success).toBe(false);
  });
});

describe("chat mention schema", () => {
  it("accepts valid mention payload", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
      mentionedUserId: "u-1",
    };
    expect(mentionUserSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects missing mentionedUserId", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
    };
    expect(mentionUserSchema.safeParse(payload).success).toBe(false);
  });
});

describe("chat moderation schema", () => {
  it("accepts delete action", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
      messageId: "m-1",
      action: "delete",
    };
    expect(moderateMessageSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts mute_author action", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
      messageId: "m-1",
      action: "mute_author",
    };
    expect(moderateMessageSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts lock_thread action", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
      messageId: "m-1",
      action: "lock_thread",
    };
    expect(moderateMessageSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects invalid action", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
      messageId: "m-1",
      action: "ban",
    };
    expect(moderateMessageSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects missing messageId", () => {
    const payload = {
      workspaceId: "ws-1",
      threadId: "t-1",
      action: "delete",
    };
    expect(moderateMessageSchema.safeParse(payload).success).toBe(false);
  });
});
