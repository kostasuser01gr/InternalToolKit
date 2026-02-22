import { z } from "zod";

import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";

const updateShortcutSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(60).optional(),
  command: z.string().trim().min(1).max(300).optional(),
  keybinding: z.string().trim().max(40).optional(),
  position: z.number().int().min(0).optional(),
});

type RouteContext = {
  params: Promise<{ shortcutId: string }>;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const payload = updateShortcutSchema.parse(await request.json());
    const { shortcutId } = await context.params;
    const { user, workspace } = await getAppContext(payload.workspaceId);

    const existing = await db.userShortcut.findFirst({
      where: {
        id: shortcutId,
        userId: user.id,
        workspaceId: workspace.id,
      },
    });

    if (!existing) {
      return Response.json(
        { ok: false, error: "Shortcut not found." },
        { status: 404 },
      );
    }

    const updated = await db.userShortcut.update({
      where: { id: existing.id },
      data: {
        ...(payload.label ? { label: payload.label } : {}),
        ...(payload.command ? { command: payload.command } : {}),
        ...(payload.keybinding ? { keybinding: payload.keybinding } : {}),
        ...(payload.position !== undefined ? { position: payload.position } : {}),
      },
    });

    return Response.json({
      ok: true,
      item: {
        id: updated.id,
        workspaceId: updated.workspaceId,
        label: updated.label,
        command: updated.command,
        keybinding: updated.keybinding ?? undefined,
        position: updated.position,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { ok: false, error: error.issues[0]?.message ?? "Invalid shortcut payload." },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { shortcutId } = await context.params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const { user, workspace } = await getAppContext(workspaceId);

    const existing = await db.userShortcut.findFirst({
      where: {
        id: shortcutId,
        userId: user.id,
        workspaceId: workspace.id,
      },
    });

    if (!existing) {
      return Response.json(
        { ok: false, error: "Shortcut not found." },
        { status: 404 },
      );
    }

    await db.userShortcut.delete({
      where: { id: existing.id },
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
