"use server";

import { AttendanceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission, requireWorkspaceRole } from "@/lib/rbac";
import {
  recordAttendanceSchema,
  createSkillSchema,
  assignSkillSchema,
  createTrainingSchema,
  updateTrainingRecordSchema,
} from "@/lib/validators/workforce";
import { WorkspaceRole } from "@prisma/client";

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

export async function recordAttendanceAction(formData: FormData) {
  const parsed = recordAttendanceSchema.parse({
    workspaceId: formData.get("workspaceId"),
    type: formData.get("type"),
    notes: formData.get("notes") || undefined,
    deviceId: formData.get("deviceId") || undefined,
  });

  try {
    const { user } = await requireWorkspaceRole(parsed.workspaceId, [
      WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.EMPLOYEE, WorkspaceRole.WASHER,
    ]);

    await db.attendance.create({
      data: {
        workspaceId: parsed.workspaceId,
        userId: user.id,
        type: parsed.type,
        notes: parsed.notes ?? null,
        deviceId: parsed.deviceId ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "workforce.attendance_recorded",
      entityType: "attendance",
      entityId: user.id,
      metaJson: { type: parsed.type },
    });

    revalidatePath("/workforce");
    redirect(buildUrl("/workforce", { success: `${parsed.type} recorded.` }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/workforce", { error: getErrorMessage(error) }));
  }
}

export async function createSkillAction(formData: FormData) {
  const parsed = createSkillSchema.parse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "shifts", "write");

    const skill = await db.skill.create({
      data: {
        workspaceId: parsed.workspaceId,
        name: parsed.name,
        description: parsed.description ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "workforce.skill_created",
      entityType: "skill",
      entityId: skill.id,
      metaJson: { name: skill.name },
    });

    revalidatePath("/workforce");
    redirect(buildUrl("/workforce", { success: "Skill created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/workforce", { error: getErrorMessage(error) }));
  }
}

export async function assignSkillAction(formData: FormData) {
  const parsed = assignSkillSchema.parse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
    skillId: formData.get("skillId"),
    level: formData.get("level"),
    expiresAt: formData.get("expiresAt") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "shifts", "write");

    await db.userSkill.upsert({
      where: { userId_skillId: { userId: parsed.userId, skillId: parsed.skillId } },
      create: {
        userId: parsed.userId,
        skillId: parsed.skillId,
        level: parsed.level,
        certifiedAt: new Date(),
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      },
      update: {
        level: parsed.level,
        certifiedAt: new Date(),
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "workforce.skill_assigned",
      entityType: "user_skill",
      entityId: parsed.userId,
      metaJson: { skillId: parsed.skillId, level: parsed.level },
    });

    revalidatePath("/workforce");
    redirect(buildUrl("/workforce", { success: "Skill assigned." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/workforce", { error: getErrorMessage(error) }));
  }
}

export async function createTrainingAction(formData: FormData) {
  const parsed = createTrainingSchema.parse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    durationMin: formData.get("durationMin") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "shifts", "write");

    const training = await db.training.create({
      data: {
        workspaceId: parsed.workspaceId,
        title: parsed.title,
        description: parsed.description ?? null,
        durationMin: parsed.durationMin ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "workforce.training_created",
      entityType: "training",
      entityId: training.id,
      metaJson: { title: training.title },
    });

    revalidatePath("/workforce");
    redirect(buildUrl("/workforce", { success: "Training created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/workforce", { error: getErrorMessage(error) }));
  }
}

export async function updateTrainingRecordAction(formData: FormData) {
  const parsed = updateTrainingRecordSchema.parse({
    workspaceId: formData.get("workspaceId"),
    trainingId: formData.get("trainingId"),
    userId: formData.get("userId"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(parsed.workspaceId, "shifts", "write");

    await db.trainingRecord.upsert({
      where: { trainingId_userId: { trainingId: parsed.trainingId, userId: parsed.userId } },
      create: {
        trainingId: parsed.trainingId,
        userId: parsed.userId,
        status: parsed.status,
        completedAt: parsed.status === "COMPLETED" ? new Date() : null,
        notes: parsed.notes ?? null,
      },
      update: {
        status: parsed.status,
        completedAt: parsed.status === "COMPLETED" ? new Date() : null,
        notes: parsed.notes ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "workforce.training_record_updated",
      entityType: "training_record",
      entityId: parsed.trainingId,
      metaJson: { userId: parsed.userId, status: parsed.status },
    });

    revalidatePath("/workforce");
    redirect(buildUrl("/workforce", { success: "Training record updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildUrl("/workforce", { error: getErrorMessage(error) }));
  }
}
