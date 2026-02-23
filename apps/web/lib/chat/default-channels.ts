/**
 * Ensure default chat channels exist for a workspace.
 * Auto-creates #ops-general and #washers-only if missing.
 */

import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

export const DEFAULT_CHANNELS = [
  {
    slug: "ops-general",
    name: "#ops-general",
    description: "General operations channel for announcements and team coordination.",
  },
  {
    slug: "washers-only",
    name: "#washers-only",
    description: "Internal channel for washer communications. Posts from kiosk devices appear here.",
  },
] as const;

/**
 * Ensures all default channels exist for the given workspace.
 * Safe to call multiple times — uses findFirst + create pattern.
 */
export async function ensureDefaultChannels(workspaceId: string): Promise<void> {
  try {
    for (const ch of DEFAULT_CHANNELS) {
      const existing = await db.chatChannel.findFirst({
        where: { workspaceId, slug: ch.slug },
      });
      if (!existing) {
        await db.chatChannel.create({
          data: {
            workspaceId,
            slug: ch.slug,
            name: ch.name,
            description: ch.description,
            type: "PUBLIC",
            isReadOnly: false,
            isArchived: false,
          },
        });
      }
    }
  } catch (err) {
    if (!isSchemaNotReadyError(err)) throw err;
  }
}
