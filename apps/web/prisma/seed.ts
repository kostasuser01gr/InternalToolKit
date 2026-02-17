import { hashSync } from "bcryptjs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  AutomationRunStatus,
  ChatRole,
  FieldType,
  GlobalRole,
  PrismaClient,
  ViewType,
  WorkspaceRole,
} from "@prisma/client";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@internal.local";
const VIEWER_EMAIL = "viewer@internal.local";

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Admin Operator",
      roleGlobal: GlobalRole.ADMIN,
      passwordHash: hashSync("Admin123!", 12),
    },
    create: {
      email: ADMIN_EMAIL,
      name: "Admin Operator",
      roleGlobal: GlobalRole.ADMIN,
      passwordHash: hashSync("Admin123!", 12),
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: VIEWER_EMAIL },
    update: {
      name: "Viewer Analyst",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Viewer123!", 12),
    },
    create: {
      email: VIEWER_EMAIL,
      name: "Viewer Analyst",
      roleGlobal: GlobalRole.USER,
      passwordHash: hashSync("Viewer123!", 12),
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
    await prisma.record.createMany({
      data: [
        {
          tableId: incidentTable.id,
          dataJson: {
            Title: "Billing latency spike",
            Priority: "High",
            Open: true,
            Owner: "SRE Alpha",
            DueDate: "2026-02-18",
          },
        },
        {
          tableId: incidentTable.id,
          dataJson: {
            Title: "Failed webhook retries",
            Priority: "Medium",
            Open: true,
            Owner: "Platform Team",
            DueDate: "2026-02-19",
          },
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

  console.log("Seed complete", {
    admin: ADMIN_EMAIL,
    viewer: VIEWER_EMAIL,
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
