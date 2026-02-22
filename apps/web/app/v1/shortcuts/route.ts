import { shortcutDefinitionSchema } from "@internal-toolkit/shared";
import { z } from "zod";

import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";

const createShortcutSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(60),
  command: z.string().trim().min(1).max(300),
  keybinding: z.string().trim().max(40).optional(),
  position: z.number().int().min(0).optional(),
});

function toIso(value: Date) {
  return value.toISOString();
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const { user, workspace } = await getAppContext(workspaceId);

    const shortcuts = await db.userShortcut.findMany({
      where: {
        userId: user.id,
        workspaceId: workspace.id,
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    return Response.json({
      ok: true,
      items: shortcuts.map((shortcut) =>
        shortcutDefinitionSchema.parse({
          id: shortcut.id,
          workspaceId: shortcut.workspaceId,
          label: shortcut.label,
          command: shortcut.command,
          keybinding: shortcut.keybinding ?? undefined,
          position: shortcut.position,
          createdAt: toIso(shortcut.createdAt),
          updatedAt: toIso(shortcut.updatedAt),
        }),
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = createShortcutSchema.parse(await request.json());
    const { user, workspace } = await getAppContext(payload.workspaceId);

    const created = await db.userShortcut.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        label: payload.label,
        command: payload.command,
        keybinding: payload.keybinding ?? null,
        position: payload.position ?? 0,
      },
    });

    return Response.json(
      {
        ok: true,
        item: shortcutDefinitionSchema.parse({
          id: created.id,
          workspaceId: created.workspaceId,
          label: created.label,
          command: created.command,
          keybinding: created.keybinding ?? undefined,
          createdAt: toIso(created.createdAt),
          updatedAt: toIso(created.updatedAt),
        }),
      },
      { status: 201 },
    );
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
