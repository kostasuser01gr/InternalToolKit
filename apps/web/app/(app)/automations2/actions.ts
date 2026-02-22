"use server";

import { AutomationRuleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from "@/lib/validators/automations2";

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const s = query.toString();
  return s ? `${base}?${s}` : base;
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}

export async function createAutomationRuleAction(formData: FormData) {
  const parsed = createAutomationRuleSchema.parse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    triggerJson: formData.get("triggerJson"),
    conditionJson: formData.get("conditionJson") || undefined,
    actionJson: formData.get("actionJson"),
    schedule: formData.get("schedule") || undefined,
    retryMax: formData.get("retryMax") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "data", "write");

    const rule = await db.automationRule.create({
      data: {
        workspaceId: parsed.workspaceId,
        createdBy: user.id,
        name: parsed.name,
        description: parsed.description ?? null,
        triggerJson: JSON.parse(parsed.triggerJson),
        conditionJson: parsed.conditionJson ? JSON.parse(parsed.conditionJson) : null,
        actionJson: JSON.parse(parsed.actionJson),
        schedule: parsed.schedule ?? null,
        retryMax: parsed.retryMax ?? 3,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "automation.rule_created",
      entityType: "automation_rule",
      entityId: rule.id,
      metaJson: { name: rule.name },
    });

    revalidatePath("/automations2");
    redirect(buildUrl("/automations2", { success: "Rule created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/automations2", { error: getErrorMessage(error) }));
  }
}

export async function updateAutomationRuleAction(formData: FormData) {
  const parsed = updateAutomationRuleSchema.parse({
    workspaceId: formData.get("workspaceId"),
    ruleId: formData.get("ruleId"),
    name: formData.get("name") || undefined,
    status: formData.get("status") || undefined,
    triggerJson: formData.get("triggerJson") || undefined,
    conditionJson: formData.get("conditionJson") || undefined,
    actionJson: formData.get("actionJson") || undefined,
    schedule: formData.get("schedule") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "data", "write");

    const updated = await db.automationRule.update({
      where: { id: parsed.ruleId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.triggerJson ? { triggerJson: JSON.parse(parsed.triggerJson) } : {}),
        ...(parsed.conditionJson !== undefined
          ? { conditionJson: parsed.conditionJson ? JSON.parse(parsed.conditionJson) : null }
          : {}),
        ...(parsed.actionJson ? { actionJson: JSON.parse(parsed.actionJson) } : {}),
        ...(parsed.schedule !== undefined ? { schedule: parsed.schedule ?? null } : {}),
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "automation.rule_updated",
      entityType: "automation_rule",
      entityId: updated.id,
      metaJson: { name: updated.name, status: updated.status },
    });

    revalidatePath("/automations2");
    redirect(buildUrl("/automations2", { success: "Rule updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/automations2", { error: getErrorMessage(error) }));
  }
}
