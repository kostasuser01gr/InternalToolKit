import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

/**
 * /api/cron/housekeeping — cleanup old data, resolve dead letters, etc.
 * Intended to be called by Vercel Cron (prod-only).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, string> = {};

  // 1. Purge old dead-letter entries (resolved > 30 days ago)
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleted = await db.deadLetterEntry.deleteMany({
      where: {
        resolvedAt: { not: null, lt: thirtyDaysAgo },
      },
    });
    results["dead_letters_purged"] = String(deleted.count);
  } catch (err) {
    if (isSchemaNotReadyError(err)) {
      results["dead_letters_purged"] = "schema_not_ready";
    } else {
      results["dead_letters_purged"] = err instanceof Error ? err.message : "error";
    }
  }

  // 2. Purge old cron run logs (> 90 days)
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const deleted = await db.cronRun.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
      },
    });
    results["cron_logs_purged"] = String(deleted.count);
  } catch (err) {
    if (isSchemaNotReadyError(err)) {
      results["cron_logs_purged"] = "schema_not_ready";
    } else {
      results["cron_logs_purged"] = err instanceof Error ? err.message : "error";
    }
  }

  // 3. Purge expired auth sessions
  try {
    const deleted = await db.authSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    results["expired_sessions_purged"] = String(deleted.count);
  } catch (err) {
    results["expired_sessions_purged"] = err instanceof Error ? err.message : "error";
  }

  // 4. Fleet SLA breach detection — notify coordinators
  try {
    const slaStates = ["NEEDS_CLEANING", "CLEANING", "QC_PENDING"];
    const vehicles = await db.vehicle.findMany({
      where: {
        status: { in: slaStates as never[] },
        slaBreachedAt: null,
      },
      select: { id: true, plateNumber: true, status: true, workspaceId: true, updatedAt: true },
    });

    const { DEFAULT_SLA_CONFIGS } = await import("@/lib/fleet-pipeline");
    let breachCount = 0;
    const now = Date.now();

    for (const v of vehicles) {
      const config = DEFAULT_SLA_CONFIGS[v.status];
      if (!config) continue;
      const elapsed = now - v.updatedAt.getTime();
      if (elapsed > config.maxMinutes * 60_000) {
        // Mark as breached
        await db.vehicle.update({
          where: { id: v.id },
          data: { slaBreachedAt: new Date() },
        });

        // Create notification for workspace admins
        const admins = await db.workspaceMember.findMany({
          where: { workspaceId: v.workspaceId, role: { in: ["ADMIN", "EDITOR"] } },
          select: { userId: true },
        });

        for (const admin of admins) {
          await db.notification.create({
            data: {
              userId: admin.userId,
              type: "sla_breach",
              title: `SLA Breach: ${v.plateNumber}`,
              body: `Vehicle ${v.plateNumber} has exceeded ${config.maxMinutes}min in ${v.status.replace(/_/g, " ")} state.`,
            },
          });
        }

        // Create vehicle event for timeline
        await db.vehicleEvent.create({
          data: {
            workspaceId: v.workspaceId,
            vehicleId: v.id,
            type: "SLA_BREACH",
            valueText: `Exceeded ${config.maxMinutes}min in ${v.status}`,
          },
        });

        breachCount++;
      }
    }
    results["sla_breaches_detected"] = String(breachCount);
  } catch (err) {
    if (isSchemaNotReadyError(err)) {
      results["sla_breaches_detected"] = "schema_not_ready";
    } else {
      results["sla_breaches_detected"] = err instanceof Error ? err.message : "error";
    }
  }

  return NextResponse.json({
    success: true,
    results,
    timestamp: new Date().toISOString(),
  });
}
