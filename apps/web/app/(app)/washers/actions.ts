"use server";

import { WasherTaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { rethrowIfRedirectError } from "@/lib/redirect-error";
import { AuthError, requireWorkspacePermission } from "@/lib/rbac";
import {
  createWasherTaskSchema,
  updateWasherTaskSchema,
} from "@/lib/validators/washers";

function buildWashersUrl(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `/washers?${serialized}` : "/washers";
}

function getErrorMessage(error: unknown) {
  if (error instanceof AuthError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid payload.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function createWasherTaskAction(formData: FormData) {
  const parsed = createWasherTaskSchema.parse({
    workspaceId: formData.get("workspaceId"),
    vehicleId: formData.get("vehicleId"),
    washerUserId: formData.get("washerUserId") || undefined,
    status: formData.get("status") || WasherTaskStatus.TODO,
    exteriorDone: checkboxValue(formData, "exteriorDone"),
    interiorDone: checkboxValue(formData, "interiorDone"),
    vacuumDone: checkboxValue(formData, "vacuumDone"),
    notes: formData.get("notes") || undefined,
    voiceTranscript: formData.get("voiceTranscript") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "washers",
      "write",
    );

    const task = await db.washerTask.create({
      data: {
        workspaceId: parsed.workspaceId,
        vehicleId: parsed.vehicleId,
        washerUserId: parsed.washerUserId ?? user.id,
        status: parsed.status,
        exteriorDone: parsed.exteriorDone ?? false,
        interiorDone: parsed.interiorDone ?? false,
        vacuumDone: parsed.vacuumDone ?? false,
        notes: parsed.notes ?? null,
        voiceTranscript: parsed.voiceTranscript ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "washers.task_created",
      entityType: "washer_task",
      entityId: task.id,
      metaJson: {
        vehicleId: task.vehicleId,
        status: task.status,
      },
    });

    revalidatePath("/washers");
    revalidatePath("/fleet");
    revalidatePath("/calendar");
    redirect(buildWashersUrl({ success: "Washer task created." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildWashersUrl({ error: getErrorMessage(error) }));
  }
}

export async function updateWasherTaskAction(formData: FormData) {
  const parsed = updateWasherTaskSchema.parse({
    workspaceId: formData.get("workspaceId"),
    taskId: formData.get("taskId"),
    status: formData.get("status"),
    exteriorDone: checkboxValue(formData, "exteriorDone"),
    interiorDone: checkboxValue(formData, "interiorDone"),
    vacuumDone: checkboxValue(formData, "vacuumDone"),
    notes: formData.get("notes") || undefined,
    voiceTranscript: formData.get("voiceTranscript") || undefined,
  });

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "washers",
      "write",
    );

    const task = await db.washerTask.update({
      where: {
        id: parsed.taskId,
      },
      data: {
        status: parsed.status,
        exteriorDone: parsed.exteriorDone,
        interiorDone: parsed.interiorDone,
        vacuumDone: parsed.vacuumDone,
        notes: parsed.notes ?? null,
        voiceTranscript: parsed.voiceTranscript ?? null,
      },
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "washers.task_updated",
      entityType: "washer_task",
      entityId: task.id,
      metaJson: {
        status: task.status,
        exteriorDone: task.exteriorDone,
        interiorDone: task.interiorDone,
        vacuumDone: task.vacuumDone,
      },
    });

    revalidatePath("/washers");
    revalidatePath("/fleet");
    revalidatePath("/calendar");
    redirect(buildWashersUrl({ success: "Washer task updated." }));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(buildWashersUrl({ error: getErrorMessage(error) }));
  }
}

// ---------------------------------------------------------------------------
// Bulk update + Undo
// ---------------------------------------------------------------------------

const bulkUpdateSchema = z.object({
  workspaceId: z.string().min(1),
  taskIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.nativeEnum(WasherTaskStatus).optional(),
  exteriorDone: z.boolean().optional(),
  interiorDone: z.boolean().optional(),
  vacuumDone: z.boolean().optional(),
});

export type BulkUpdateResult = {
  ok: boolean;
  updated: number;
  previousStates: Array<{
    id: string;
    status: WasherTaskStatus;
    exteriorDone: boolean;
    interiorDone: boolean;
    vacuumDone: boolean;
  }>;
  error?: string;
};

export async function bulkUpdateWasherTasksAction(
  input: z.infer<typeof bulkUpdateSchema>,
): Promise<BulkUpdateResult> {
  const parsed = bulkUpdateSchema.parse(input);

  try {
    const { user } = await requireWorkspacePermission(
      parsed.workspaceId,
      "washers",
      "write",
    );

    // Snapshot previous states for undo
    const tasks = await db.washerTask.findMany({
      where: { id: { in: parsed.taskIds }, workspaceId: parsed.workspaceId },
      select: { id: true, status: true, exteriorDone: true, interiorDone: true, vacuumDone: true },
    });

    const previousStates = tasks.map((t) => ({
      id: t.id,
      status: t.status,
      exteriorDone: t.exteriorDone,
      interiorDone: t.interiorDone,
      vacuumDone: t.vacuumDone,
    }));

    // Build update data (only set fields that were provided)
    const data: Record<string, unknown> = {};
    if (parsed.status !== undefined) data.status = parsed.status;
    if (parsed.exteriorDone !== undefined) data.exteriorDone = parsed.exteriorDone;
    if (parsed.interiorDone !== undefined) data.interiorDone = parsed.interiorDone;
    if (parsed.vacuumDone !== undefined) data.vacuumDone = parsed.vacuumDone;

    const result = await db.washerTask.updateMany({
      where: { id: { in: parsed.taskIds }, workspaceId: parsed.workspaceId },
      data,
    });

    await appendAuditLog({
      workspaceId: parsed.workspaceId,
      actorUserId: user.id,
      action: "washers.bulk_updated",
      entityType: "washer_task",
      entityId: parsed.taskIds.join(","),
      metaJson: { count: result.count, ...data },
    });

    revalidatePath("/washers");
    return { ok: true, updated: result.count, previousStates };
  } catch (error) {
    return {
      ok: false,
      updated: 0,
      previousStates: [],
      error: getErrorMessage(error),
    };
  }
}

export async function undoWasherTasksAction(
  workspaceId: string,
  previousStates: BulkUpdateResult["previousStates"],
): Promise<{ ok: boolean; restored: number; error?: string }> {
  try {
    const { user } = await requireWorkspacePermission(
      workspaceId,
      "washers",
      "write",
    );

    let restored = 0;
    for (const prev of previousStates) {
      await db.washerTask.update({
        where: { id: prev.id },
        data: {
          status: prev.status,
          exteriorDone: prev.exteriorDone,
          interiorDone: prev.interiorDone,
          vacuumDone: prev.vacuumDone,
        },
      });
      restored++;
    }

    await appendAuditLog({
      workspaceId,
      actorUserId: user.id,
      action: "washers.bulk_undo",
      entityType: "washer_task",
      entityId: previousStates.map((p) => p.id).join(","),
      metaJson: { restored },
    });

    revalidatePath("/washers");
    return { ok: true, restored };
  } catch (error) {
    return { ok: false, restored: 0, error: getErrorMessage(error) };
  }
}
