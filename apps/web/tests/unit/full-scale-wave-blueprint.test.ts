import { describe, expect, it } from "vitest";

import { MODULE_BACKEND_DECISIONS, assertBackendDecisionLocked } from "@/lib/backend-decision";
import { EVENT_CONTRACTS } from "@/lib/events/contracts";
import { getRbacDriftStatus } from "@/lib/governance/rbac-drift";
import { createPurchaseOrderSchema, purchaseOrderActionSchema } from "@/lib/validators/procurement";
import { createWorkOrderSchema, transitionWorkOrderSchema } from "@/lib/validators/work-orders";
import { canTransitionWorkOrder } from "@/lib/work-orders-state";

describe("Wave 1 — backend decision lock", () => {
  it("defines locked read/write path for key modules", () => {
    expect(MODULE_BACKEND_DECISIONS.fleet?.readPath).toBe("prisma");
    expect(MODULE_BACKEND_DECISIONS.work_orders?.writePath).toBe("prisma");
    expect(MODULE_BACKEND_DECISIONS.procurement?.writePath).toBe("prisma");
  });

  it("throws when a module does not have lock metadata", () => {
    expect(() => assertBackendDecisionLocked("unknown_module")).toThrow();
  });
});

describe("Wave 2/3 — event contracts", () => {
  it("includes required rollout events", () => {
    expect(EVENT_CONTRACTS).toContain("workorder.updated");
    expect(EVENT_CONTRACTS).toContain("incident.escalated");
    expect(EVENT_CONTRACTS).toContain("procurement.received");
    expect(EVENT_CONTRACTS).toContain("sla.breached");
  });
});

describe("Governance drift check", () => {
  it("returns no drift when baseline hash is not provided", () => {
    const status = getRbacDriftStatus();
    expect(status.driftDetected).toBe(false);
    expect(status.currentHash).toBe(status.baselineHash);
  });
});

describe("Work order state machine", () => {
  it("allows valid transitions", () => {
    expect(canTransitionWorkOrder("OPEN", "ASSIGNED")).toBe(true);
    expect(canTransitionWorkOrder("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionWorkOrder("IN_PROGRESS", "DONE")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionWorkOrder("DONE", "IN_PROGRESS")).toBe(false);
    expect(canTransitionWorkOrder("CANCELLED", "OPEN")).toBe(false);
  });
});

describe("Work order validators", () => {
  it("accepts create payload with lines", () => {
    const parsed = createWorkOrderSchema.safeParse({
      workspaceId: "ws1",
      title: "Replace brake pads",
      lines: [
        {
          lineType: "PART",
          description: "Brake pads",
          quantity: 1,
          unitCost: 120,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts transition payload", () => {
    const parsed = transitionWorkOrderSchema.safeParse({
      workspaceId: "ws1",
      workOrderId: "wo1",
      nextStatus: "BLOCKED",
    });

    expect(parsed.success).toBe(true);
  });
});

describe("Procurement validators", () => {
  it("accepts create purchase order payload", () => {
    const parsed = createPurchaseOrderSchema.safeParse({
      workspaceId: "ws1",
      title: "Order detergents",
      lines: [
        {
          itemName: "Detergent 10L",
          quantity: 2,
          unitCost: 35,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts procurement action payload", () => {
    const parsed = purchaseOrderActionSchema.safeParse({
      workspaceId: "ws1",
      purchaseOrderId: "po1",
      action: "approve",
    });

    expect(parsed.success).toBe(true);
  });
});
