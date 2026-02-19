import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AutomationRunStatus,
  ChatRole,
  FieldType,
  GlobalRole,
  PrismaClient,
  ShiftRequestStatus,
  ShiftRequestType,
  ShiftStatus,
  VehicleEventType,
  VehicleStatus,
  ViewType,
  WasherTaskStatus,
  WorkspaceRole,
} from "@prisma/client";

import { buildRecordSearchText, getRecordOpenIndicator } from "../lib/data-record";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_toolkit?schema=public";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const ADMIN_EMAIL = "admin@internal.local";
const VIEWER_EMAIL = "viewer@internal.local";
const EMPLOYEE_EMAIL = "employee@internal.local";
const WASHER_EMAIL = "washer@internal.local";

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      loginName: "admin",
      name: "Admin Operator",
      roleGlobal: GlobalRole.ADMIN,
      passwordHash: hashSync("Admin123!", 12),
      pinHash: hashSync("1234", 12),
    },
    create: {
      email: ADMIN_EMAIL,
      loginName: "admin",
      name: "Admin Operator",
      roleGlobal: GlobalRole.ADMIN,
      passwordHash: hashSync("Admin123!", 12),
      pinHash: hashSync("1234", 12),
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: VIEWER_EMAIL },
    update: {
      loginName: "viewer",
      name: "Viewer Analyst",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Viewer123!", 12),
      pinHash: hashSync("2222", 12),
    },
    create: {
      email: VIEWER_EMAIL,
      loginName: "viewer",
      name: "Viewer Analyst",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Viewer123!", 12),
      pinHash: hashSync("2222", 12),
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: EMPLOYEE_EMAIL },
    update: {
      loginName: "employee",
      name: "Employee Ops",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Employee123!", 12),
      pinHash: hashSync("3456", 12),
    },
    create: {
      email: EMPLOYEE_EMAIL,
      loginName: "employee",
      name: "Employee Ops",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Employee123!", 12),
      pinHash: hashSync("3456", 12),
    },
  });

  const washer = await prisma.user.upsert({
    where: { email: WASHER_EMAIL },
    update: {
      loginName: "washer",
      name: "Washer Crew",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Washer123!", 12),
      pinHash: hashSync("7777", 12),
    },
    create: {
      email: WASHER_EMAIL,
      loginName: "washer",
      name: "Washer Crew",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Washer123!", 12),
      pinHash: hashSync("7777", 12),
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: "seed-workspace" },
    update: {
      name: "Ops Workspace",
      ownerId: admin.id,
    },
    create: {
      id: "seed-workspace",
      name: "Ops Workspace",
      ownerId: admin.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: admin.id,
      },
    },
    update: {
      role: WorkspaceRole.ADMIN,
    },
    create: {
      workspaceId: workspace.id,
      userId: admin.id,
      role: WorkspaceRole.ADMIN,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: employee.id,
      },
    },
    update: {
      role: WorkspaceRole.EMPLOYEE,
    },
    create: {
      workspaceId: workspace.id,
      userId: employee.id,
      role: WorkspaceRole.EMPLOYEE,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: viewer.id,
      },
    },
    update: {
      role: WorkspaceRole.VIEWER,
    },
    create: {
      workspaceId: workspace.id,
      userId: viewer.id,
      role: WorkspaceRole.VIEWER,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: washer.id,
      },
    },
    update: {
      role: WorkspaceRole.WASHER,
    },
    create: {
      workspaceId: workspace.id,
      userId: washer.id,
      role: WorkspaceRole.WASHER,
    },
  });

  const incidentTable = await prisma.table.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: "Incidents",
      },
    },
    update: {
      description: "Live production incidents and responses",
    },
    create: {
      workspaceId: workspace.id,
      name: "Incidents",
      description: "Live production incidents and responses",
    },
  });

  const fieldSeeds = [
    { name: "Title", type: FieldType.TEXT, position: 0 },
    { name: "Priority", type: FieldType.SELECT, position: 1 },
    { name: "Open", type: FieldType.BOOLEAN, position: 2 },
    { name: "Owner", type: FieldType.TEXT, position: 3 },
    { name: "DueDate", type: FieldType.DATE, position: 4 },
  ] as const;

  for (const fieldSeed of fieldSeeds) {
    await prisma.field.upsert({
      where: {
        tableId_name: {
          tableId: incidentTable.id,
          name: fieldSeed.name,
        },
      },
      update: {
        type: fieldSeed.type,
        position: fieldSeed.position,
      },
      create: {
        tableId: incidentTable.id,
        name: fieldSeed.name,
        type: fieldSeed.type,
        position: fieldSeed.position,
      },
    });
  }

  const recordCount = await prisma.record.count({
    where: { tableId: incidentTable.id },
  });
  if (recordCount === 0) {
    const firstPayload = {
      Title: "Billing latency spike",
      Priority: "High",
      Open: true,
      Owner: "SRE Alpha",
      DueDate: "2026-02-18",
    };
    const secondPayload = {
      Title: "Failed webhook retries",
      Priority: "Medium",
      Open: true,
      Owner: "Platform Team",
      DueDate: "2026-02-19",
    };

    await prisma.record.createMany({
      data: [
        {
          tableId: incidentTable.id,
          dataJson: firstPayload,
          searchText: buildRecordSearchText(firstPayload),
          openIndicator: getRecordOpenIndicator(firstPayload),
        },
        {
          tableId: incidentTable.id,
          dataJson: secondPayload,
          searchText: buildRecordSearchText(secondPayload),
          openIndicator: getRecordOpenIndicator(secondPayload),
        },
      ],
    });
  }

  const viewTypes = [
    ViewType.GRID,
    ViewType.KANBAN,
    ViewType.CALENDAR,
    ViewType.LIST,
  ] as const;

  for (const viewType of viewTypes) {
    await prisma.view.upsert({
      where: { id: `seed-view-${viewType.toLowerCase()}` },
      update: {
        tableId: incidentTable.id,
        name: `${viewType} View`,
        type: viewType,
        configJson:
          viewType === ViewType.KANBAN
            ? { groupBy: "Priority" }
            : viewType === ViewType.CALENDAR
              ? { dateField: "DueDate" }
              : {},
        isDefault: viewType === ViewType.GRID,
      },
      create: {
        id: `seed-view-${viewType.toLowerCase()}`,
        tableId: incidentTable.id,
        name: `${viewType} View`,
        type: viewType,
        configJson:
          viewType === ViewType.KANBAN
            ? { groupBy: "Priority" }
            : viewType === ViewType.CALENDAR
              ? { dateField: "DueDate" }
              : {},
        isDefault: viewType === ViewType.GRID,
      },
    });
  }

  const automation = await prisma.automation.upsert({
    where: { id: "seed-automation" },
    update: {
      workspaceId: workspace.id,
      name: "Notify on Incident Create",
      enabled: true,
      triggerJson: { type: "record.created", tableId: incidentTable.id },
      actionsJson: [
        {
          type: "create_notification",
          userId: admin.id,
          title: "New incident",
          body: "Review new incident record",
        },
        { type: "write_audit_log", action: "automation.seed.triggered" },
      ],
    },
    create: {
      id: "seed-automation",
      workspaceId: workspace.id,
      name: "Notify on Incident Create",
      enabled: true,
      triggerJson: { type: "record.created", tableId: incidentTable.id },
      actionsJson: [
        {
          type: "create_notification",
          userId: admin.id,
          title: "New incident",
          body: "Review new incident record",
        },
        { type: "write_audit_log", action: "automation.seed.triggered" },
      ],
    },
  });

  await prisma.automationRun.upsert({
    where: { id: "seed-automation-run" },
    update: {
      automationId: automation.id,
      status: AutomationRunStatus.SUCCESS,
      logsJson: [{ message: "Seed run completed" }],
    },
    create: {
      id: "seed-automation-run",
      automationId: automation.id,
      status: AutomationRunStatus.SUCCESS,
      logsJson: [{ message: "Seed run completed" }],
    },
  });

  const assistantThread = await prisma.chatThread.upsert({
    where: { id: "seed-assistant-thread" },
    update: {
      workspaceId: workspace.id,
      title: "Assistant History",
      createdBy: admin.id,
    },
    create: {
      id: "seed-assistant-thread",
      workspaceId: workspace.id,
      title: "Assistant History",
      createdBy: admin.id,
    },
  });

  const assistantMessageCount = await prisma.chatMessage.count({
    where: { threadId: assistantThread.id },
  });

  if (assistantMessageCount === 0) {
    await prisma.chatMessage.createMany({
      data: [
        {
          threadId: assistantThread.id,
          authorUserId: admin.id,
          role: ChatRole.USER,
          content: "Summarize this week's incident queue.",
        },
        {
          threadId: assistantThread.id,
          role: ChatRole.ASSISTANT,
          content:
            "High priority incidents increased 18%, with billing latency as top concern.",
        },
      ],
    });
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorUserId: admin.id,
      action: "seed.initialized",
      entityType: "workspace",
      entityId: workspace.id,
      metaJson: { source: "prisma-seed" },
    },
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: "system",
      title: "Workspace ready",
      body: "Demo workspace and seeded records are available.",
    },
  });

  const now = new Date();
  const shiftOneStart = new Date(now);
  shiftOneStart.setHours(8, 0, 0, 0);
  const shiftOneEnd = new Date(now);
  shiftOneEnd.setHours(16, 0, 0, 0);
  const shiftTwoStart = new Date(now);
  shiftTwoStart.setDate(shiftTwoStart.getDate() + 1);
  shiftTwoStart.setHours(9, 0, 0, 0);
  const shiftTwoEnd = new Date(now);
  shiftTwoEnd.setDate(shiftTwoEnd.getDate() + 1);
  shiftTwoEnd.setHours(17, 0, 0, 0);

  const morningShift = await prisma.shift.upsert({
    where: { id: "seed-shift-1" },
    update: {
      workspaceId: workspace.id,
      assignedUserId: employee.id,
      createdBy: admin.id,
      title: "Morning counter operations",
      startsAt: shiftOneStart,
      endsAt: shiftOneEnd,
      status: ShiftStatus.PUBLISHED,
      notes: "Priority: arrivals and check-ins",
    },
    create: {
      id: "seed-shift-1",
      workspaceId: workspace.id,
      assignedUserId: employee.id,
      createdBy: admin.id,
      title: "Morning counter operations",
      startsAt: shiftOneStart,
      endsAt: shiftOneEnd,
      status: ShiftStatus.PUBLISHED,
      notes: "Priority: arrivals and check-ins",
    },
  });

  await prisma.shift.upsert({
    where: { id: "seed-shift-2" },
    update: {
      workspaceId: workspace.id,
      assignedUserId: washer.id,
      createdBy: admin.id,
      title: "Vehicle wash lane",
      startsAt: shiftTwoStart,
      endsAt: shiftTwoEnd,
      status: ShiftStatus.PUBLISHED,
      notes: "Deep cleaning queue",
    },
    create: {
      id: "seed-shift-2",
      workspaceId: workspace.id,
      assignedUserId: washer.id,
      createdBy: admin.id,
      title: "Vehicle wash lane",
      startsAt: shiftTwoStart,
      endsAt: shiftTwoEnd,
      status: ShiftStatus.PUBLISHED,
      notes: "Deep cleaning queue",
    },
  });

  await prisma.shiftRequest.upsert({
    where: { id: "seed-shift-request-1" },
    update: {
      workspaceId: workspace.id,
      requesterId: employee.id,
      shiftId: morningShift.id,
      type: ShiftRequestType.SWAP,
      status: ShiftRequestStatus.PENDING,
      startsAt: shiftOneStart,
      endsAt: shiftOneEnd,
      reason: "Need swap for medical appointment.",
    },
    create: {
      id: "seed-shift-request-1",
      workspaceId: workspace.id,
      requesterId: employee.id,
      shiftId: morningShift.id,
      type: ShiftRequestType.SWAP,
      status: ShiftRequestStatus.PENDING,
      startsAt: shiftOneStart,
      endsAt: shiftOneEnd,
      reason: "Need swap for medical appointment.",
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: {
      workspaceId_plateNumber: {
        workspaceId: workspace.id,
        plateNumber: "KIN-2047",
      },
    },
    update: {
      model: "Toyota Yaris",
      status: VehicleStatus.NEEDS_CLEANING,
      mileageKm: 68450,
      fuelPercent: 54,
      notes: "Inspect rear bumper scratch.",
    },
    create: {
      workspaceId: workspace.id,
      plateNumber: "KIN-2047",
      model: "Toyota Yaris",
      status: VehicleStatus.NEEDS_CLEANING,
      mileageKm: 68450,
      fuelPercent: 54,
      notes: "Inspect rear bumper scratch.",
    },
  });

  await prisma.vehicleEvent.upsert({
    where: { id: "seed-vehicle-event-1" },
    update: {
      workspaceId: workspace.id,
      vehicleId: vehicle.id,
      actorUserId: admin.id,
      type: VehicleEventType.DAMAGE_REPORT,
      notes: "Rear bumper scratch captured during return inspection.",
      valueText: "minor",
    },
    create: {
      id: "seed-vehicle-event-1",
      workspaceId: workspace.id,
      vehicleId: vehicle.id,
      actorUserId: admin.id,
      type: VehicleEventType.DAMAGE_REPORT,
      notes: "Rear bumper scratch captured during return inspection.",
      valueText: "minor",
    },
  });

  await prisma.washerTask.upsert({
    where: { id: "seed-washer-task-1" },
    update: {
      workspaceId: workspace.id,
      vehicleId: vehicle.id,
      washerUserId: washer.id,
      status: WasherTaskStatus.IN_PROGRESS,
      exteriorDone: true,
      interiorDone: false,
      vacuumDone: true,
      notes: "Need stain treatment on rear seats.",
      voiceTranscript: "rear seats need extra stain treatment",
    },
    create: {
      id: "seed-washer-task-1",
      workspaceId: workspace.id,
      vehicleId: vehicle.id,
      washerUserId: washer.id,
      status: WasherTaskStatus.IN_PROGRESS,
      exteriorDone: true,
      interiorDone: false,
      vacuumDone: true,
      notes: "Need stain treatment on rear seats.",
      voiceTranscript: "rear seats need extra stain treatment",
    },
  });

  console.log("Seed complete", {
    admin: ADMIN_EMAIL,
    viewer: VIEWER_EMAIL,
    employee: EMPLOYEE_EMAIL,
    washer: WASHER_EMAIL,
    workspaceId: workspace.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
