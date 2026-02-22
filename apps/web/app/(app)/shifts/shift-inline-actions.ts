"use server";

import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireWorkspacePermission } from "@/lib/rbac";

const EDITABLE_FIELDS = new Set(["title", "notes"]);

/**
 * Inline update a single shift field. Returns ok/error for client confirmation.
 */
export async function inlineUpdateShiftFieldAction(input: {
  workspaceId: string;
  shiftId: string;
  field: string;
  value: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!EDITABLE_FIELDS.has(input.field)) {
    return { ok: false, error: `Field "${input.field}" is not editable inline.` };
  }

  try {
    const { user } = await requireWorkspacePermission(
      input.workspaceId,
      "shifts",
      "write",
    );

    const previous = await db.shift.findUniqueOrThrow({
      where: { id: input.shiftId },
      select: { title: true, notes: true },
    });

    const previousValue = String(previous[input.field as keyof typeof previous] ?? "");

    const coerced: string | null = input.field === "notes" && input.value === "" ? null : input.value;

    await db.shift.update({
      where: { id: input.shiftId },
      data: { [input.field]: coerced },
    });

    await appendAuditLog({
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: "shifts.shift_inline_edit",
      entityType: "shift",
      entityId: input.shiftId,
      metaJson: {
        field: input.field,
        from: previousValue,
        to: String(coerced ?? ""),
      },
    });

    revalidatePath("/shifts");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error.",
    };
  }
}
