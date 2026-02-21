import { WasherTaskStatus } from "@prisma/client";
import { z } from "zod";

import { appendAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest, logSecurityEvent } from "@/lib/security";

const KIOSK_TOKEN = process.env.KIOSK_TOKEN ?? "";
const KIOSK_STATION_ID = process.env.KIOSK_STATION_ID ?? "default";

const createKioskTaskSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  deviceId: z.string().min(1).max(120),
  status: z.nativeEnum(WasherTaskStatus).default(WasherTaskStatus.TODO),
  exteriorDone: z.boolean().default(false),
  interiorDone: z.boolean().default(false),
  vacuumDone: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional(),
  voiceTranscript: z.string().trim().max(1000).optional(),
});

function validateKioskToken(request: Request): boolean {
  if (!KIOSK_TOKEN) return false;
  const header = request.headers.get("x-kiosk-token");
  if (!header) return false;
  // Constant-time comparison
  if (header.length !== KIOSK_TOKEN.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ KIOSK_TOKEN.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { ok: false, error: "cross_origin_blocked" },
      { status: 403 },
    );
  }

  const authorized = validateKioskToken(request);

  if (!authorized) {
    logSecurityEvent("kiosk_unauthorized_write", {
      route: "/api/kiosk/tasks",
    });
    return Response.json(
      { ok: false, error: "invalid_kiosk_token", message: "Read-only mode: invalid or missing kiosk token." },
      { status: 403 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = createKioskTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      },
      { status: 400 },
    );
  }

  const { idempotencyKey, deviceId, workspaceId, vehicleId } = parsed.data;
  const stationId = KIOSK_STATION_ID;

  // Rate limiting by deviceId + stationId
  const rateLimitResult = checkRateLimit({
    key: `kiosk:${deviceId}:${stationId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimitResult.allowed) {
    return Response.json(
      {
        ok: false,
        error: "rate_limited",
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // Idempotency check: if same key exists, return existing record
  const existingByKey = await db.washerTask.findUnique({
    where: { idempotencyKey },
    include: { vehicle: true },
  });

  if (existingByKey) {
    await appendAuditLog({
      workspaceId,
      action: "kiosk.task_dedupe_hit",
      entityType: "washer_task",
      entityId: existingByKey.id,
      metaJson: { idempotencyKey, deviceId, stationId, severity: "normal" },
    });
    return Response.json({
      ok: true,
      deduped: true,
      message: "Existing task updated (deduped).",
      task: existingByKey,
    });
  }

  // Check for active task on same vehicle today (prevent duplicates)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const activeTaskForVehicle = await db.washerTask.findFirst({
    where: {
      workspaceId,
      vehicleId,
      status: { in: [WasherTaskStatus.TODO, WasherTaskStatus.IN_PROGRESS] },
      createdAt: { gte: todayStart, lte: todayEnd },
    },
    include: { vehicle: true },
  });

  if (activeTaskForVehicle) {
    // Merge/update existing task instead of creating new
    const updatedTask = await db.washerTask.update({
      where: { id: activeTaskForVehicle.id },
      data: {
        notes: parsed.data.notes ?? activeTaskForVehicle.notes,
        voiceTranscript:
          parsed.data.voiceTranscript ?? activeTaskForVehicle.voiceTranscript,
        exteriorDone: parsed.data.exteriorDone || activeTaskForVehicle.exteriorDone,
        interiorDone: parsed.data.interiorDone || activeTaskForVehicle.interiorDone,
        vacuumDone: parsed.data.vacuumDone || activeTaskForVehicle.vacuumDone,
        deviceId,
        stationId,
      },
      include: { vehicle: true },
    });

    await appendAuditLog({
      workspaceId,
      action: "kiosk.task_merged",
      entityType: "washer_task",
      entityId: updatedTask.id,
      metaJson: {
        idempotencyKey,
        deviceId,
        stationId,
        mergedWithId: activeTaskForVehicle.id,
        severity: "normal",
      },
    });

    return Response.json({
      ok: true,
      deduped: true,
      message: "Existing task updated (deduped).",
      task: updatedTask,
    });
  }

  // Create new task
  const task = await db.washerTask.create({
    data: {
      workspaceId,
      vehicleId,
      status: parsed.data.status,
      exteriorDone: parsed.data.exteriorDone,
      interiorDone: parsed.data.interiorDone,
      vacuumDone: parsed.data.vacuumDone,
      notes: parsed.data.notes ?? null,
      voiceTranscript: parsed.data.voiceTranscript ?? null,
      idempotencyKey,
      deviceId,
      stationId,
    },
    include: { vehicle: true },
  });

  await appendAuditLog({
    workspaceId,
    action: "kiosk.task_created",
    entityType: "washer_task",
    entityId: task.id,
    metaJson: {
      vehicleId,
      idempotencyKey,
      deviceId,
      stationId,
      status: task.status,
      severity: "normal",
    },
  });

  return Response.json({
    ok: true,
    deduped: false,
    message: "Task created.",
    task,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const dateParam = url.searchParams.get("date");

  if (!workspaceId) {
    return Response.json(
      { ok: false, error: "missing_workspace_id" },
      { status: 400 },
    );
  }

  const date = dateParam ? new Date(dateParam) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const tasks = await db.washerTask.findMany({
    where: {
      workspaceId,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: { vehicle: true, washer: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ ok: true, tasks });
}
