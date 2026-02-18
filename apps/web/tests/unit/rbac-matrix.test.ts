import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { hasWorkspacePermission } from "@/lib/rbac";

describe("workspace RBAC matrix", () => {
  it("denies access when role is missing", () => {
    expect(hasWorkspacePermission(null, "fleet", "read")).toBe(false);
    expect(hasWorkspacePermission(null, "admin", "manage_members")).toBe(
      false,
    );
  });

  it("allows admin management only to admins", () => {
    expect(
      hasWorkspacePermission(WorkspaceRole.ADMIN, "admin", "manage_members"),
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
  });

  it("allows washer writes only in washer domain", () => {
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "washers", "write")).toBe(
      true,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "fleet", "write")).toBe(
      false,
    );
    expect(hasWorkspacePermission(WorkspaceRole.WASHER, "chat", "write")).toBe(
      true,
    );
  });

  it("allows employees to operate shifts and fleet", () => {
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
  });
});
