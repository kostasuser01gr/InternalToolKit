import { describe, it, expect } from "vitest";

// Inventory validators
import {
  createAssetSchema,
  updateAssetSchema,
  recordHandoverSchema,
} from "@/lib/validators/inventory";

// Incidents validators
import {
  createIncidentSchema,
  updateIncidentSchema,
} from "@/lib/validators/incidents";

// Automations 2.0 validators
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from "@/lib/validators/automations2";

// Search validators
import {
  createSavedViewSchema,
  createRunbookSchema,
  updateRunbookSchema,
} from "@/lib/validators/search";

// Compliance validators
import {
  createRetentionPolicySchema,
  createAccessReviewSchema,
  resolveAccessReviewSchema,
} from "@/lib/validators/compliance";

// Station validators
import {
  createStationSchema,
  updateStationSchema,
} from "@/lib/validators/station";

// Workforce validators
import {
  recordAttendanceSchema,
  createSkillSchema,
  assignSkillSchema,
  createTrainingSchema,
  updateTrainingRecordSchema,
} from "@/lib/validators/workforce";

// Prisma enums for valid enum values
import {
  AssetType,
  AssetStatus,
  IncidentSeverity,
  IncidentStatus,
  AutomationRuleStatus,
  AttendanceType,
  SkillLevel,
  TrainingStatus,
} from "@prisma/client";

describe("Phase 10 — Inventory validators", () => {
  it("accepts valid createAsset input", () => {
    const result = createAssetSchema.safeParse({
      workspaceId: "ws1",
      type: AssetType.KEY,
      name: "Master Key #1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects createAsset with missing name", () => {
    const result = createAssetSchema.safeParse({
      workspaceId: "ws1",
      type: AssetType.KEY,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid updateAsset", () => {
    const result = updateAssetSchema.safeParse({
      workspaceId: "ws1",
      assetId: "a1",
      status: AssetStatus.IN_USE,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid handover", () => {
    const result = recordHandoverSchema.safeParse({
      workspaceId: "ws1",
      assetId: "a1",
      action: "Handed over",
      toUserId: "u2",
    });
    expect(result.success).toBe(true);
  });

  it("rejects handover with short action", () => {
    const result = recordHandoverSchema.safeParse({
      workspaceId: "ws1",
      assetId: "a1",
      action: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("Phase 10 — Incidents validators", () => {
  it("accepts valid createIncident", () => {
    const result = createIncidentSchema.safeParse({
      workspaceId: "ws1",
      severity: IncidentSeverity.HIGH,
      title: "Bumper scratch on vehicle",
    });
    expect(result.success).toBe(true);
  });

  it("rejects createIncident with short title", () => {
    const result = createIncidentSchema.safeParse({
      workspaceId: "ws1",
      severity: IncidentSeverity.LOW,
      title: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("accepts updateIncident with status change", () => {
    const result = updateIncidentSchema.safeParse({
      workspaceId: "ws1",
      incidentId: "inc1",
      status: IncidentStatus.RESOLVED,
      repairCost: 150,
    });
    expect(result.success).toBe(true);
  });

  it("accepts updateIncident with vehicle link", () => {
    const result = createIncidentSchema.safeParse({
      workspaceId: "ws1",
      vehicleId: "v1",
      severity: IncidentSeverity.CRITICAL,
      title: "Major body damage",
      description: "Driver side door dented",
    });
    expect(result.success).toBe(true);
  });
});

describe("Phase 10 — Automations 2.0 validators", () => {
  it("accepts valid createAutomationRule", () => {
    const result = createAutomationRuleSchema.safeParse({
      workspaceId: "ws1",
      name: "Auto-assign cleaning",
      triggerJson: '{"event":"vehicle_returned"}',
      actionJson: '{"action":"create_task"}',
    });
    expect(result.success).toBe(true);
  });

  it("rejects rule with invalid triggerJson", () => {
    const result = createAutomationRuleSchema.safeParse({
      workspaceId: "ws1",
      name: "Bad rule",
      triggerJson: "",
      actionJson: '{"action":"x"}',
    });
    expect(result.success).toBe(false);
  });

  it("accepts updateAutomationRule with status change", () => {
    const result = updateAutomationRuleSchema.safeParse({
      workspaceId: "ws1",
      ruleId: "rule1",
      status: AutomationRuleStatus.PAUSED,
    });
    expect(result.success).toBe(true);
  });

  it("accepts rule with schedule and retries", () => {
    const result = createAutomationRuleSchema.safeParse({
      workspaceId: "ws1",
      name: "Daily export",
      triggerJson: '{"type":"schedule"}',
      actionJson: '{"action":"export_csv"}',
      schedule: "0 6 * * *",
      retryMax: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects retryMax > 10", () => {
    const result = createAutomationRuleSchema.safeParse({
      workspaceId: "ws1",
      name: "Too many retries",
      triggerJson: '{"e":"x"}',
      actionJson: '{"a":"y"}',
      retryMax: 11,
    });
    expect(result.success).toBe(false);
  });
});

describe("Phase 10 — Search/Views/Runbooks validators", () => {
  it("accepts valid savedView", () => {
    const result = createSavedViewSchema.safeParse({
      workspaceId: "ws1",
      name: "My fleet view",
      module: "fleet",
      filtersJson: '{"status":"READY"}',
    });
    expect(result.success).toBe(true);
  });

  it("rejects savedView with no filters", () => {
    const result = createSavedViewSchema.safeParse({
      workspaceId: "ws1",
      name: "Bad view",
      module: "fleet",
      filtersJson: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid runbook", () => {
    const result = createRunbookSchema.safeParse({
      workspaceId: "ws1",
      title: "QC Inspection SOP",
      content: "Step 1: Check exterior for damage. Step 2: Check interior cleanliness.",
      tags: "qc,inspection",
      pinned: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects runbook with short content", () => {
    const result = createRunbookSchema.safeParse({
      workspaceId: "ws1",
      title: "Empty runbook",
      content: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts updateRunbook", () => {
    const result = updateRunbookSchema.safeParse({
      workspaceId: "ws1",
      runbookId: "rb1",
      title: "Updated SOP Title",
    });
    expect(result.success).toBe(true);
  });
});

describe("Phase 10 — Compliance validators", () => {
  it("accepts valid retention policy", () => {
    const result = createRetentionPolicySchema.safeParse({
      workspaceId: "ws1",
      module: "chat",
      retainDays: 365,
    });
    expect(result.success).toBe(true);
  });

  it("rejects retention < 1 day", () => {
    const result = createRetentionPolicySchema.safeParse({
      workspaceId: "ws1",
      module: "chat",
      retainDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects retention > 3650 days", () => {
    const result = createRetentionPolicySchema.safeParse({
      workspaceId: "ws1",
      module: "chat",
      retainDays: 4000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid access review creation", () => {
    const result = createAccessReviewSchema.safeParse({
      workspaceId: "ws1",
      targetUserId: "u2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts resolveAccessReview APPROVED", () => {
    const result = resolveAccessReviewSchema.safeParse({
      workspaceId: "ws1",
      reviewId: "rev1",
      status: "APPROVED",
      decision: "Confirmed active employee",
    });
    expect(result.success).toBe(true);
  });

  it("accepts resolveAccessReview REVOKED", () => {
    const result = resolveAccessReviewSchema.safeParse({
      workspaceId: "ws1",
      reviewId: "rev1",
      status: "REVOKED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid resolve status", () => {
    const result = resolveAccessReviewSchema.safeParse({
      workspaceId: "ws1",
      reviewId: "rev1",
      status: "MAYBE",
    });
    expect(result.success).toBe(false);
  });
});

describe("Phase 10 — Station/Multi-station validators", () => {
  it("accepts valid station creation", () => {
    const result = createStationSchema.safeParse({
      workspaceId: "ws1",
      name: "Downtown Hub",
      code: "DTH",
    });
    expect(result.success).toBe(true);
  });

  it("uppercases station code", () => {
    const result = createStationSchema.parse({
      workspaceId: "ws1",
      name: "Airport Station",
      code: "apt",
    });
    expect(result.code).toBe("APT");
  });

  it("rejects station with too-short code", () => {
    const result = createStationSchema.safeParse({
      workspaceId: "ws1",
      name: "Bad Station",
      code: "X",
    });
    expect(result.success).toBe(false);
  });

  it("accepts updateStation", () => {
    const result = updateStationSchema.safeParse({
      workspaceId: "ws1",
      stationId: "st1",
      isActive: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("Phase 10 — Workforce validators", () => {
  it("accepts valid attendance record", () => {
    const result = recordAttendanceSchema.safeParse({
      workspaceId: "ws1",
      type: AttendanceType.CHECK_IN,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid skill creation", () => {
    const result = createSkillSchema.safeParse({
      workspaceId: "ws1",
      name: "QC Inspection",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid skill assignment", () => {
    const result = assignSkillSchema.safeParse({
      workspaceId: "ws1",
      userId: "u1",
      skillId: "sk1",
      level: SkillLevel.ADVANCED,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid training creation", () => {
    const result = createTrainingSchema.safeParse({
      workspaceId: "ws1",
      title: "Fire Safety Training",
    });
    expect(result.success).toBe(true);
  });

  it("accepts training record update", () => {
    const result = updateTrainingRecordSchema.safeParse({
      workspaceId: "ws1",
      trainingId: "tr1",
      userId: "u1",
      status: TrainingStatus.COMPLETED,
    });
    expect(result.success).toBe(true);
  });

  it("rejects skill with too-short name", () => {
    const result = createSkillSchema.safeParse({
      workspaceId: "ws1",
      name: "X",
    });
    expect(result.success).toBe(false);
  });
});
