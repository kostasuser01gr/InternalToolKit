import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type SecuritySeverity = "info" | "warn" | "critical";

type SecurityEventInput = {
  event: string;
  severity?: SecuritySeverity;
  requestId?: string | undefined;
  actorUserId?: string | undefined;
  targetUserId?: string | undefined;
  ipAddress?: string | undefined;
  deviceId?: string | undefined;
  route?: string | undefined;
  details?: Record<string, unknown> | undefined;
};

export async function appendSecurityEvent(input: SecurityEventInput) {
  await db.securityEvent.create({
    data: {
      event: input.event,
      severity: input.severity ?? "info",
      requestId: input.requestId ?? null,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      ipAddress: input.ipAddress ?? null,
      deviceId: input.deviceId ?? null,
      route: input.route ?? null,
      detailsJson: (input.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}
