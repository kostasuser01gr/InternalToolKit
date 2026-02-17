"use server";

import { AutomationRunStatus, Prisma, WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { USAGE_LIMITS } from "@/lib/constants/limits";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspaceRole } from "@/lib/rbac";
import { logSecurityEvent } from "@/lib/security";
import {
  createAutomationSchema,
  runAutomationSchema,
} from "@/lib/validators/automations";

function buildAutomationsUrl(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();

  return queryString ? `/automations?${queryString}` : "/automations";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

export async function createAutomationAction(formData: FormData) {
  const parsed = createAutomationSchema.parse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    enabled: formData.get("enabled") === "on",
    triggerType: formData.get("triggerType"),
    triggerTableId: formData.get("triggerTableId") || undefined,
    notificationUserId: formData.get("notificationUserId") || undefined,
    notificationTitle: formData.get("notificationTitle") || undefined,
    notificationBody: formData.get("notificationBody") || undefined,
    auditAction: formData.get("auditAction") || undefined,
    updateRecordTableId: formData.get("updateRecordTableId") || undefined,
    updateRecordId: formData.get("updateRecordId") || undefined,
    updateRecordField: formData.get("updateRecordField") || undefined,
    updateRecordValue: formData.get("updateRecordValue") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const count = await db.automation.count({
      where: {
        workspaceId: parsed.workspaceId,
      },
    });

    if (count >= USAGE_LIMITS.maxAutomationsPerWorkspace) {
      throw new Error(
        `Automation limit reached (${USAGE_LIMITS.maxAutomationsPerWorkspace}).`,
      );
    }

    if (parsed.triggerTableId) {
      const table = await db.table.findFirst({
        where: {
          id: parsed.triggerTableId,
          workspaceId: parsed.workspaceId,
        },
      });

      if (!table) {
        throw new Error("Trigger table is not in your workspace.");
      }
    }

    const actions: Array<Record<string, string>> = [];

    if (
      parsed.notificationUserId &&
      parsed.notificationTitle &&
      parsed.notificationBody
    ) {
      actions.push({
        type: "create_notification",
        userId: parsed.notificationUserId,
        title: parsed.notificationTitle,
        body: parsed.notificationBody,
      });
    }

    if (parsed.auditAction) {
      actions.push({
        type: "write_audit_log",
        action: parsed.auditAction,
      });
    }

    if (
      parsed.updateRecordTableId &&
      parsed.updateRecordId &&
      parsed.updateRecordField &&
      parsed.updateRecordValue
    ) {
      actions.push({
        type: "update_record",
        tableId: parsed.updateRecordTableId,
        recordId: parsed.updateRecordId,
        field: parsed.updateRecordField,
        value: parsed.updateRecordValue,
      });
    }

    if (actions.length === 0) {
      throw new Error("At least one action must be configured.");
    }

    const automation = await db.automation.create({
      data: {
        workspaceId: parsed.workspaceId,
        name: parsed.name,
        enabled: parsed.enabled,
        triggerJson: {
          type: parsed.triggerType,
          tableId: parsed.triggerTableId,
        },
        actionsJson: actions,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "automation.created",
      entityType: "automation",
      entityId: automation.id,
      metaJson: {
        trigger: parsed.triggerType,
        actionCount: actions.length,
      },
    });

    logSecurityEvent("mutation.automation_created", {
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      automationId: automation.id,
    });

    revalidatePath("/automations");
    redirect(
      buildAutomationsUrl({
        workspaceId: parsed.workspaceId,
        success: "Automation created.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildAutomationsUrl({
        workspaceId: parsed.workspaceId,
        error: getErrorMessage(error),
      }),
    );
  }
}

export async function runAutomationNowAction(formData: FormData) {
  const parsed = runAutomationSchema.parse({
    workspaceId: formData.get("workspaceId"),
    automationId: formData.get("automationId"),
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN,
      WorkspaceRole.EDITOR,
    ]);

    const automation = await db.automation.findFirst({
      where: {
        id: parsed.automationId,
        workspaceId: parsed.workspaceId,
      },
    });

    if (!automation) {
      throw new Error("Automation not found.");
    }

    const run = await db.automationRun.create({
      data: {
        automationId: automation.id,
        status: AutomationRunStatus.RUNNING,
        logsJson: [],
      },
    });

    const logs: Array<{ level: "info" | "error"; message: string }> = [
      { level: "info", message: `Manual run started by ${user.id}.` },
    ];

    let hasError = false;

    const actions = Array.isArray(automation.actionsJson)
      ? (automation.actionsJson as Array<Record<string, string>>)
      : [];

    for (const action of actions) {
      try {
        if (action.type === "create_notification") {
          if (!action.userId) {
            throw new Error("Missing notification userId.");
          }

          await db.notification.create({
            data: {
              userId: action.userId,
              type: "automation",
              title: action.title ?? "Automation notification",
              body: action.body ?? "Automation run generated a notification.",
            },
          });

          logs.push({
            level: "info",
            message: "Notification action completed.",
          });
        }

        if (action.type === "write_audit_log") {
          await appendAuditLog({
            workspaceId: parsed.workspaceId,
            actorUserId: user.id,
            action: action.action ?? "automation.run",
            entityType: "automation",
            entityId: automation.id,
            metaJson: { runId: run.id },
          });

          logs.push({ level: "info", message: "Audit action completed." });
        }

        if (action.type === "update_record") {
          if (!action.recordId || !action.tableId || !action.field) {
            throw new Error("Missing update_record parameters.");
          }

          const record = await db.record.findFirst({
            where: {
              id: action.recordId,
              tableId: action.tableId,
              table: { workspaceId: parsed.workspaceId },
            },
          });

          if (!record) {
            throw new Error("Record for update action not found.");
          }

          const payload = {
            ...(record.dataJson as Record<string, unknown>),
            [action.field]: action.value,
          };

          await db.record.update({
            where: { id: record.id },
            data: {
              dataJson: payload as Prisma.InputJsonValue,
            },
          });

          logs.push({
            level: "info",
            message: "Record update action completed.",
          });
        }
      } catch (error) {
        rethrowIfRedirectError(error);
        hasError = true;
        logs.push({
          level: "error",
          message:
            error instanceof Error ? error.message : "Unknown action failure",
        });
      }
    }

    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: hasError
          ? AutomationRunStatus.FAILED
          : AutomationRunStatus.SUCCESS,
        finishedAt: new Date(),
        logsJson: logs,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "automation.run_now",
      entityType: "automation",
      entityId: automation.id,
      metaJson: {
        runId: run.id,
        status: hasError ? "FAILED" : "SUCCESS",
      },
    });

    revalidatePath("/automations");
    redirect(
      buildAutomationsUrl({
        workspaceId: parsed.workspaceId,
        success: hasError
          ? "Automation finished with errors. Inspect logs."
          : "Automation run completed successfully.",
      }),
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      buildAutomationsUrl({
        workspaceId: parsed.workspaceId,
        error: getErrorMessage(error),
      }),
    );
  }
}
