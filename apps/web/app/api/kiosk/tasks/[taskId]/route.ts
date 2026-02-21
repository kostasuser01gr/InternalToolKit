import { WasherTaskStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { getRequestId, logWebRequest, withObservabilityHeaders } from "@/lib/http-observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest, logSecurityEvent } from "@/lib/security";

const KIOSK_TOKEN = process.env.KIOSK_TOKEN ?? "";
const KIOSK_STATION_ID = process.env.KIOSK_STATION_ID ?? "default";

const updateKioskTaskSchema = z.object({
  workspaceId: z.string().min(1),
  deviceId: z.string().min(1).max(120),
  status: z.nativeEnum(WasherTaskStatus),
});

function validateKioskToken(request: Request): boolean {
  if (!KIOSK_TOKEN) return false;
  const header = request.headers.get("x-kiosk-token");
  if (!header) return false;
  if (header.length !== KIOSK_TOKEN.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ KIOSK_TOKEN.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const startMs = Date.now();
  const requestId = getRequestId(request);
  const { taskId } = await params;

  if (!isSameOriginRequest(request)) {
    return Response.json(
      { ok: false, error: "cross_origin_blocked" },
      withObservabilityHeaders({ status: 403 }, requestId),
    );
  }

  const authorized = validateKioskToken(request);
  if (!authorized) {
    logSecurityEvent("kiosk_unauthorized_write", { route: `/api/kiosk/tasks/${taskId}` });
    return Response.json(
      { ok: false, error: "invalid_kiosk_token", message: "Read-only mode: invalid or missing kiosk token." },
      withObservabilityHeaders({ status: 403 }, requestId),
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json" },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  }

  const parsed = updateKioskTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      },
      withObservabilityHeaders({ status: 400 }, requestId),
    );
  }

  const { deviceId, workspaceId, status } = parsed.data;
  const stationId = KIOSK_STATION_ID;

  const rateLimitResult = checkRateLimit({
    key: `kiosk:${deviceId}:${stationId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimitResult.allowed) {
    return Response.json(
      { ok: false, error: "rate_limited", retryAfterSeconds: rateLimitResult.retryAfterSeconds },
      withObservabilityHeaders({ status: 429 }, requestId),
    );
  }

  const existing = await db.washerTask.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return Response.json(
      { ok: false, error: "not_found", message: "Task not found." },
      withObservabilityHeaders({ status: 404 }, requestId),
    );
  }

  const task = await db.washerTask.update({
    where: { id: taskId },
    data: { status, deviceId, stationId },
    select: {
      id: true,
      status: true,
      vehicleId: true,
      createdAt: true,
      updatedAt: true,
      stationId: true,
    },
  });

  const durationMs = Date.now() - startMs;
  logWebRequest({
    event: "kiosk.task_updated",
    requestId,
    route: `/api/kiosk/tasks/${taskId}`,
    method: "PATCH",
    status: 200,
    durationMs,
    details: { taskId, status, deviceId, stationId },
  });

  return Response.json(
    { ok: true, task },
    withObservabilityHeaders({ status: 200 }, requestId),
  );
}
