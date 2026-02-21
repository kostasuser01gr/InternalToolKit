import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { hasWorkspacePermission } from "@/lib/rbac";

describe("workspace RBAC matrix", () => {
  it("denies access when role is missing", () => {
    expect(hasWorkspacePermission(null, "fleet", "read")).toBe(false);
    expect(hasWorkspacePermission(null, "admin", "manage_members")).toBe(
      false,
    );
    expect(hasWorkspacePermission(null, "chat", "read")).toBe(false);
    expect(hasWorkspacePermission(null, "shifts", "write")).toBe(false);
    expect(hasWorkspacePermission(null, "notifications", "read")).toBe(false);
  });

  it("allows admin management only to admins", () => {
    expect(
      hasWorkspacePermission(WorkspaceRole.ADMIN, "admin", "manage_members"),
    ).toBe(true);
    expect(
      hasWorkspacePermission(WorkspaceRole.ADMIN, "admin", "read_audit"),
    ).toBe(true);
    expect(
      hasWorkspacePermission(
        WorkspaceRole.EMPLOYEE,
        "admin",
        "manage_members",
      ),
    ).toBe(false);
    expect(
      hasWorkspacePermission(WorkspaceRole.WASHER, "admin", "manage_members"),
    ).toBe(false);
    expect(
      hasWorkspacePermission(WorkspaceRole.EDITOR, "admin", "manage_members"),
    ).toBe(false);
    expect(
      hasWorkspacePermission(WorkspaceRole.VIEWER, "admin", "manage_members"),
    ).toBe(false);
    expect(
      hasWorkspacePermission(WorkspaceRole.VIEWER, "admin", "read_audit"),
    ).toBe(false);
  });

  it("allows washer writes only in washer and chat domains", () => {
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "washers", "write")).toBe(
      true,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "fleet", "write")).toBe(
      false,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "chat", "write")).toBe(
      true,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "data", "write")).toBe(
      false,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "shifts", "write")).toBe(
      false,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "calendar", "write")).toBe(
      false,
    );
  });

  it("allows employees to operate shifts and fleet but not approve", () => {
    expect(hasWorkspacePermission(WorkspaceRole.EMPLOYEE, "shifts", "write")).toBe(
      true,
    );
    expect(hasWorkspacePermission(WorkspaceRole.EMPLOYEE, "fleet", "write")).toBe(
      true,
    );
    expect(
      hasWorkspacePermission(
        WorkspaceRole.EMPLOYEE,
        "shifts",
        "approve_requests",
      ),
    ).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.EMPLOYEE, "data", "write")).toBe(
      true,
    );
    expect(hasWorkspacePermission(WorkspaceRole.EMPLOYEE, "calendar", "write")).toBe(
      true,
    );
    expect(
      hasWorkspacePermission(WorkspaceRole.EMPLOYEE, "admin", "manage_members"),
    ).toBe(false);
  });

  it("grants admin full access across all resources", () => {
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "chat", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "chat", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "data", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "data", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "shifts", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "shifts", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "shifts", "approve_requests")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "fleet", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "fleet", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "washers", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "washers", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "calendar", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "calendar", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.ADMIN, "notifications", "read")).toBe(true);
  });

  it("restricts viewer to read-only across all resources", () => {
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "chat", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "chat", "write")).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "data", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "data", "write")).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "shifts", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "shifts", "write")).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "fleet", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "fleet", "write")).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "washers", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "washers", "write")).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "calendar", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "calendar", "write")).toBe(false);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "notifications", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.VIEWER, "admin", "manage_members")).toBe(false);
  });

  it("editor can approve shift requests", () => {
    expect(
      hasWorkspacePermission(WorkspaceRole.EDITOR, "shifts", "approve_requests"),
    ).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.EDITOR, "shifts", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.EDITOR, "data", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.EDITOR, "fleet", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.EDITOR, "washers", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.EDITOR, "calendar", "write")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.EDITOR, "chat", "write")).toBe(true);
    expect(
      hasWorkspacePermission(WorkspaceRole.EDITOR, "admin", "manage_members"),
    ).toBe(false);
  });

  it("washer can read all standard resources", () => {
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "chat", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "data", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "shifts", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "fleet", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "washers", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "calendar", "read")).toBe(true);
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "notifications", "read")).toBe(true);
  });
});
